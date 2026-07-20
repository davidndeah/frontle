// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// ============================================================
//  FrontleWeekly — Pot semanal de la liga (Celo) · Frontle v2
//
//  Contrato SEPARADO de FrontleGame: el reto diario y su pot siguen intactos.
//  Aquí vive la economía de la liga semanal (`docs/PLAN-FRONTLE-V2.md`):
//
//   - buyCoins(amount): el jugador compra MONEDAS de juego pagando en
//     stablecoin. El 100% del pago entra al pot de la semana en curso. Las
//     monedas NO son un token: son un saldo en la base de datos del backend,
//     que las acredita al ver el evento `CoinsPurchased` de esta compra. El
//     contrato solo custodia el dinero y reparte el premio.
//   - fundPot(amount): la plataforma siembra el premio base de la semana.
//   - rollWeek(week, first, second, third): el operator cierra una semana ya
//     terminada con el podio de XP. El CONTRATO calcula los montos → el
//     operador no puede manipularlos.
//   - claim(week, place): cada ganador retira su parte.
//
//  Reparto del pot semanal (`_computeShares`):
//    · 50% al 1º · 30% al 2º · 10% al 3º · 10% de recaudo al protocolo.
//    · Puesto vacante (menos de 3 participantes): su parte NO se reparte —
//      se acumula al pot de la semana siguiente, junto con el polvo del
//      redondeo. Conservación exacta: cut + a1 + a2 + a3 + rollover == pot.
//    · Nadie en el podio → no se puede rollWeek; el owner recupera el pot
//      con recoverUnrolledPot (premio base sembrado / se re-siembra).
//
//  La "semana" se deriva ON-CHAIN de block.timestamp y arranca el LUNES UTC
//  (el epoch Unix cayó en jueves: de ahí el +3 antes de dividir entre 7),
//  igual que el ciclo de la liga en el frontend.
//
//  ⚠️ Cumplimiento: competir es GRATIS (el XP se gana jugando, nunca se
//  compra) y las monedas compran consumibles del juego, no entradas al
//  torneo. El premio lo siembra la casa. Ver PLAN-FRONTLE-V2 §3.3.
// ============================================================

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract FrontleWeekly is Ownable {
    using SafeERC20 for IERC20;

    /// @notice Puestos del podio (índice usado en los mappings por puesto).
    uint8 public constant PLACE_FIRST = 1;
    uint8 public constant PLACE_SECOND = 2;
    uint8 public constant PLACE_THIRD = 3;

    /// @notice Tope del recaudo: 50+30+10 del podio deja como mucho un 10%.
    /// @dev Sin este límite, un `protocolBps` mayor haría que las partes
    ///      sumaran más del pot y `_computeShares` revertiría por underflow —
    ///      el cierre semanal quedaría bloqueado. Se valida al desplegar y en
    ///      `setParams` para que no se pueda romper ni por error de config.
    uint256 public constant MAX_PROTOCOL_BPS = 1000;

    /// @notice Stablecoin único de la liga (USDT en mainnet; mock en tests).
    IERC20 public immutable token;

    /// @notice Wallet del backend: cierra las semanas (rollWeek).
    address public operator;
    /// @notice Compra mínima de monedas, para evitar spam de polvo.
    uint256 public minPurchase;
    /// @notice Recaudo del protocolo al repartir, en basis points (1000 = 10%).
    uint256 public protocolBps;

    /// @notice Pot acumulado por semana (índice de semana UTC, lunes a lunes).
    mapping(uint256 => uint256) public pot;
    /// @notice Ganador asignado a cada (semana, puesto) tras rollWeek.
    mapping(uint256 => mapping(uint8 => address)) public winnerOf;
    /// @notice Premio que le corresponde a cada (semana, puesto), fijado en rollWeek.
    mapping(uint256 => mapping(uint8 => uint256)) public prize;
    /// @notice Si el (semana, puesto) ya fue reclamado.
    mapping(uint256 => mapping(uint8 => bool)) public claimed;
    /// @notice Si la semana ya fue cerrada por el operator (o recuperada por el owner).
    mapping(uint256 => bool) public rolled;
    /// @notice Recaudo de protocolo acumulado y aún no retirado.
    uint256 public protocolAccrued;

    error NotOperator();
    error ZeroAddress();
    error InvalidBps();
    error InvalidPlace();
    error AmountTooSmall();
    error WeekNotEnded();
    error AlreadyRolled();
    error NoWinners();
    error DuplicateWinner();
    error NotRolled();
    error NotWinner();
    error AlreadyClaimed();
    error InsufficientProtocol();

    /// @dev El backend acredita las monedas al ver este evento (y verificar el receipt).
    event CoinsPurchased(address indexed player, uint256 indexed week, uint256 amount);
    event PotFunded(uint256 indexed week, address indexed from, uint256 amount);
    event WeekRolled(uint256 indexed week, address first, address second, address third, uint256 pot);
    event RolledOver(uint256 indexed fromWeek, uint256 indexed toWeek, uint256 amount);
    event Claimed(uint256 indexed week, uint8 indexed place, address indexed winner, uint256 amount);
    event UnrolledPotRecovered(uint256 indexed week, address indexed to, uint256 amount);
    event ProtocolWithdrawn(address indexed to, uint256 amount);
    event OperatorUpdated(address indexed operator);
    event ParamsUpdated(uint256 minPurchase, uint256 protocolBps);

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    constructor(address token_, address operator_, uint256 minPurchase_, uint256 protocolBps_) Ownable(msg.sender) {
        if (token_ == address(0) || operator_ == address(0)) revert ZeroAddress();
        if (protocolBps_ > MAX_PROTOCOL_BPS) revert InvalidBps();
        token = IERC20(token_);
        operator = operator_;
        minPurchase = minPurchase_;
        protocolBps = protocolBps_;
    }

    /// @notice Índice de la semana actual (UTC, empieza el LUNES).
    /// @dev El día 0 del epoch fue jueves; +3 días alinea el corte al lunes.
    function currentWeek() public view returns (uint256) {
        return (block.timestamp / 1 days + 3) / 7;
    }

    // ============================================================
    //  Compra de monedas → 100% al pot de la semana
    //  Requiere approve() previo del jugador sobre `token`.
    // ============================================================

    /// @notice Compra monedas de juego por `amount` de stablecoin. El backend
    ///         acredita el saldo al verificar el evento de esta transacción.
    function buyCoins(uint256 amount) external {
        if (amount < minPurchase) revert AmountTooSmall();
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 week = currentWeek();
        pot[week] += amount;
        emit CoinsPurchased(msg.sender, week, amount);
    }

    /// @notice Siembra el pot de la semana actual (premio base). Requiere approve().
    function fundPot(uint256 amount) external {
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 week = currentWeek();
        pot[week] += amount;
        emit PotFunded(week, msg.sender, amount);
    }

    // ============================================================
    //  Cierre de la semana y reclamo
    // ============================================================

    /// @notice El operator cierra una semana YA TERMINADA con el podio de XP.
    ///         address(0) = ese puesto quedó vacante (su parte rueda a la
    ///         semana siguiente). El contrato calcula los montos.
    function rollWeek(uint256 week, address first, address second, address third) external onlyOperator {
        if (week >= currentWeek()) revert WeekNotEnded();
        if (rolled[week]) revert AlreadyRolled();
        if (first == address(0) && second == address(0) && third == address(0)) revert NoWinners();
        // Un mismo jugador no puede ocupar dos puestos del podio.
        if (
            (first != address(0) && (first == second || first == third))
                || (second != address(0) && second == third)
        ) revert DuplicateWinner();

        rolled[week] = true;
        uint256 p = pot[week];
        (uint256 cut, uint256 a1, uint256 a2, uint256 a3, uint256 rollover) =
            _computeShares(p, first != address(0), second != address(0), third != address(0));

        protocolAccrued += cut;

        if (first != address(0)) {
            winnerOf[week][PLACE_FIRST] = first;
            prize[week][PLACE_FIRST] = a1;
        }
        if (second != address(0)) {
            winnerOf[week][PLACE_SECOND] = second;
            prize[week][PLACE_SECOND] = a2;
        }
        if (third != address(0)) {
            winnerOf[week][PLACE_THIRD] = third;
            prize[week][PLACE_THIRD] = a3;
        }

        // Puestos vacantes + polvo del redondeo: al pot de la semana siguiente.
        if (rollover > 0) {
            uint256 next = currentWeek();
            pot[next] += rollover;
            emit RolledOver(week, next, rollover);
        }

        emit WeekRolled(week, first, second, third, p);
    }

    /// @dev Reparte `p`: 10% de recaudo + 50/30/10 a los puestos ocupados. Lo
    ///      que no se reparte (puestos vacantes y polvo) sale como `rollover`.
    ///      Conservación exacta: cut + a1 + a2 + a3 + rollover == p.
    function _computeShares(uint256 p, bool has1, bool has2, bool has3)
        internal
        view
        returns (uint256 cut, uint256 a1, uint256 a2, uint256 a3, uint256 rollover)
    {
        cut = (p * protocolBps) / 10_000;
        if (has1) a1 = (p * 50) / 100;
        if (has2) a2 = (p * 30) / 100;
        if (has3) a3 = (p * 10) / 100;
        rollover = p - cut - a1 - a2 - a3;
    }

    /// @notice El ganador de un (semana, puesto) reclama su premio. Checks-effects-interactions.
    function claim(uint256 week, uint8 place) external {
        if (place < PLACE_FIRST || place > PLACE_THIRD) revert InvalidPlace();
        if (!rolled[week]) revert NotRolled();
        if (msg.sender != winnerOf[week][place]) revert NotWinner();
        if (claimed[week][place]) revert AlreadyClaimed();
        claimed[week][place] = true; // effect
        uint256 amount = prize[week][place];
        token.safeTransfer(msg.sender, amount); // interaction
        emit Claimed(week, place, msg.sender, amount);
    }

    /// @notice Semanas terminadas sin ningún jugador en el podio: el owner
    ///         recupera el pot para re-sembrarlo. Marca la semana como cerrada
    ///         para que nadie pueda reclamarla después.
    function recoverUnrolledPot(uint256 week, address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (week >= currentWeek()) revert WeekNotEnded();
        if (rolled[week]) revert AlreadyRolled();
        rolled[week] = true;
        uint256 amount = pot[week];
        pot[week] = 0;
        token.safeTransfer(to, amount);
        emit UnrolledPotRecovered(week, to, amount);
    }

    // ============================================================
    //  Protocolo / administración (solo owner)
    // ============================================================

    /// @notice El owner retira el recaudo acumulado (no toca los pots).
    function withdrawProtocol(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount > protocolAccrued) revert InsufficientProtocol();
        protocolAccrued -= amount;
        token.safeTransfer(to, amount);
        emit ProtocolWithdrawn(to, amount);
    }

    function setOperator(address operator_) external onlyOwner {
        if (operator_ == address(0)) revert ZeroAddress();
        operator = operator_;
        emit OperatorUpdated(operator_);
    }

    function setParams(uint256 minPurchase_, uint256 protocolBps_) external onlyOwner {
        if (protocolBps_ > MAX_PROTOCOL_BPS) revert InvalidBps();
        minPurchase = minPurchase_;
        protocolBps = protocolBps_;
        emit ParamsUpdated(minPurchase_, protocolBps_);
    }
}
