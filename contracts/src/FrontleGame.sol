// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// ============================================================
//  FrontleGame v2 — Pagos y pot diario por NIVELES (Celo)
//
//  Modelo: POT DIARIO repartido entre los ganadores de 3 niveles de dificultad
//  (fácil / medio / difícil). Cada día tiene 3 retos independientes y 3 rankings.
//   - Intento extra y pistas: el jugador paga en stablecoin.
//     De cada pago, `protocolBps` va al protocolo y el resto al POT del día.
//   - rollDay(day, hard, med, easy): el backend (operator) cierra un día ya
//     terminado y pasa los ganadores de cada nivel (address(0) = nivel sin
//     ganador). El CONTRATO calcula cuánto le toca a cada uno desde pot[day]
//     con `_computeShares` → el operador no puede manipular montos.
//   - claim(day, level): cada ganador retira su parte de ese día/nivel.
//   - fundPot: la plataforma puede sembrar el pot del día (premio base).
//
//  Reparto del pot del día (`_computeShares`):
//    · Difícil+Medio+Fácil → 50% / 35% / 15%
//    · Falta Fácil (su 15% sube a Medio)     → Difícil 50%  / Medio 50%
//    · Falta Medio (su 35% sube a Difícil)   → Difícil 85%  / Fácil 15%
//    · Falta Difícil (regla del equipo)      → Medio 75%    / Fácil 25%
//    · Un solo nivel con ganador             → ese 100%
//    · Nadie                                  → no se puede rollDay; el owner
//      recupera el pot con recoverUnrolledPot (premio base / se re-siembra).
//
//  El "día" se deriva ON-CHAIN de block.timestamp (UTC) → el cliente no puede
//  falsearlo, y coincide con el reto diario del frontend (fecha UTC).
//
//  ⚠️ Nota de cumplimiento: repartir el dinero de los jugadores hacia los
//  ganadores puede considerarse apuesta y MiniPay lo restringe. Mitigación:
//  enmarcar como torneo con premio base sembrado por la plataforma (fundPot).
// ============================================================

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract FrontleGame is Ownable {
    using SafeERC20 for IERC20;

    /// @notice Niveles de dificultad (índice usado en los mappings por nivel).
    uint8 public constant LEVEL_EASY = 0;
    uint8 public constant LEVEL_MEDIUM = 1;
    uint8 public constant LEVEL_HARD = 2;

    /// @notice Stablecoin único del juego (USDm en mainnet; mock en testnet).
    IERC20 public immutable token;

    /// @notice Wallet del backend: cierra los días (rollDay).
    address public operator;
    /// @notice Precio de un intento extra (unidades mínimas del token).
    uint256 public attemptFee;
    /// @notice Precio de pista por tipo (0=inicial, 1=siguiente silueta, 2=todas). 0 = no disponible.
    mapping(uint8 => uint256) public hintFee;
    /// @notice Porción del protocolo, en basis points (2000 = 20%). El resto va al pot.
    uint256 public protocolBps;

    /// @notice Pot acumulado por día (índice de día UTC = timestamp / 1 día).
    mapping(uint256 => uint256) public pot;
    /// @notice Ganador asignado a cada (día, nivel) tras rollDay.
    mapping(uint256 => mapping(uint8 => address)) public winnerOf;
    /// @notice Premio que le corresponde a cada (día, nivel), fijado en rollDay.
    mapping(uint256 => mapping(uint8 => uint256)) public prize;
    /// @notice Si el (día, nivel) ya fue reclamado.
    mapping(uint256 => mapping(uint8 => bool)) public claimed;
    /// @notice Si el día ya fue cerrado por el operator (o recuperado por el owner).
    mapping(uint256 => bool) public rolled;
    /// @notice Comisión de protocolo acumulada y aún no retirada.
    uint256 public protocolAccrued;

    error NotOperator();
    error ZeroAddress();
    error HintNotConfigured();
    error InvalidBps();
    error InvalidLevel();
    error DayNotEnded();
    error AlreadyRolled();
    error NoWinners();
    error NotRolled();
    error NotWinner();
    error AlreadyClaimed();
    error InsufficientProtocol();

    event AttemptPaid(address indexed player, uint256 indexed day, uint256 amount);
    event HintPaid(address indexed player, uint256 indexed day, uint8 hintType, uint256 amount);
    event PotFunded(uint256 indexed day, address indexed from, uint256 amount);
    event DayRolled(uint256 indexed day, address hardWinner, address medWinner, address easyWinner, uint256 pot);
    event Claimed(uint256 indexed day, uint8 indexed level, address indexed winner, uint256 amount);
    event UnrolledPotRecovered(uint256 indexed day, address indexed to, uint256 amount);
    event ProtocolWithdrawn(address indexed to, uint256 amount);
    event OperatorUpdated(address indexed operator);
    event FeesUpdated(uint256 attemptFee, uint256 protocolBps);
    event HintFeeUpdated(uint8 indexed hintType, uint256 fee);

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    constructor(address token_, address operator_, uint256 attemptFee_, uint256 protocolBps_) Ownable(msg.sender) {
        if (token_ == address(0) || operator_ == address(0)) revert ZeroAddress();
        if (protocolBps_ > 10_000) revert InvalidBps();
        token = IERC20(token_);
        operator = operator_;
        attemptFee = attemptFee_;
        protocolBps = protocolBps_;
        // Los precios de pista (hintFee[tipo]) se configuran con setHintFee tras desplegar.
    }

    /// @notice Índice del día actual (UTC). Igual base que el reto diario del frontend.
    function currentDay() public view returns (uint256) {
        return block.timestamp / 1 days;
    }

    // ============================================================
    //  Jugador paga → split protocolo / pot del día
    //  Requiere approve() previo del jugador sobre `token`.
    // ============================================================

    function payAttempt() external {
        _collect(attemptFee);
        emit AttemptPaid(msg.sender, currentDay(), attemptFee);
    }

    function buyHint(uint8 hintType) external {
        uint256 fee = hintFee[hintType];
        if (fee == 0) revert HintNotConfigured();
        _collect(fee);
        emit HintPaid(msg.sender, currentDay(), hintType, fee);
    }

    /// @dev Cobra `fee` al jugador y lo reparte: protocolBps al protocolo, el resto al pot del día.
    function _collect(uint256 fee) internal {
        uint256 protocolCut = (fee * protocolBps) / 10_000;
        token.safeTransferFrom(msg.sender, address(this), fee);
        protocolAccrued += protocolCut;
        pot[currentDay()] += fee - protocolCut;
    }

    // ============================================================
    //  Pot: sembrar, cerrar el día y reclamar
    // ============================================================

    /// @notice Siembra el pot del día actual (premio base). Va 100% al pot. Requiere approve().
    function fundPot(uint256 amount) external {
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 day = currentDay();
        pot[day] += amount;
        emit PotFunded(day, msg.sender, amount);
    }

    /// @notice El operator cierra un día YA TERMINADO y asigna los ganadores de
    ///         cada nivel. Pasar address(0) en un nivel = ese nivel no tuvo
    ///         ganador. El contrato calcula los montos con `_computeShares`.
    function rollDay(uint256 day, address hardWinner, address medWinner, address easyWinner) external onlyOperator {
        if (day >= currentDay()) revert DayNotEnded();
        if (rolled[day]) revert AlreadyRolled();
        if (hardWinner == address(0) && medWinner == address(0) && easyWinner == address(0)) revert NoWinners();

        rolled[day] = true;
        uint256 p = pot[day];
        (uint256 aHard, uint256 aMed, uint256 aEasy) =
            _computeShares(p, hardWinner != address(0), medWinner != address(0), easyWinner != address(0));

        if (hardWinner != address(0)) {
            winnerOf[day][LEVEL_HARD] = hardWinner;
            prize[day][LEVEL_HARD] = aHard;
        }
        if (medWinner != address(0)) {
            winnerOf[day][LEVEL_MEDIUM] = medWinner;
            prize[day][LEVEL_MEDIUM] = aMed;
        }
        if (easyWinner != address(0)) {
            winnerOf[day][LEVEL_EASY] = easyWinner;
            prize[day][LEVEL_EASY] = aEasy;
        }

        emit DayRolled(day, hardWinner, medWinner, easyWinner, p);
    }

    /// @dev Reparte `p` según qué niveles tienen ganador. El nivel de mayor
    ///      prioridad presente (difícil > medio > fácil) absorbe el redondeo,
    ///      de modo que aHard+aMed+aEasy == p exactamente si hay ≥1 ganador.
    function _computeShares(uint256 p, bool hasHard, bool hasMed, bool hasEasy)
        internal
        pure
        returns (uint256 aHard, uint256 aMed, uint256 aEasy)
    {
        if (hasHard && hasMed && hasEasy) {
            aEasy = (p * 15) / 100;
            aMed = (p * 35) / 100;
            aHard = p - aEasy - aMed; // 50% + dust
        } else if (hasHard && hasMed) {
            // falta fácil: su 15% sube a medio → 50 / 50
            aMed = (p * 50) / 100;
            aHard = p - aMed;
        } else if (hasHard && hasEasy) {
            // falta medio: su 35% sube a difícil → 85 / 15
            aEasy = (p * 15) / 100;
            aHard = p - aEasy;
        } else if (hasMed && hasEasy) {
            // falta difícil (regla del equipo): 75 / 25
            aEasy = (p * 25) / 100;
            aMed = p - aEasy;
        } else if (hasHard) {
            aHard = p;
        } else if (hasMed) {
            aMed = p;
        } else if (hasEasy) {
            aEasy = p;
        }
        // ninguno → (0,0,0); rollDay ya lo previene con NoWinners.
    }

    /// @notice El ganador de un (día, nivel) reclama su premio. Checks-effects-interactions.
    function claim(uint256 day, uint8 level) external {
        if (level > LEVEL_HARD) revert InvalidLevel();
        if (!rolled[day]) revert NotRolled();
        if (msg.sender != winnerOf[day][level]) revert NotWinner();
        if (claimed[day][level]) revert AlreadyClaimed();
        claimed[day][level] = true; // effect
        uint256 amount = prize[day][level];
        token.safeTransfer(msg.sender, amount); // interaction
        emit Claimed(day, level, msg.sender, amount);
    }

    /// @notice Días terminados sin ningún ganador: el owner recupera el pot
    ///         (premio base sembrado) para re-sembrarlo o devolverlo. Marca el
    ///         día como cerrado para que nadie pueda reclamarlo después.
    function recoverUnrolledPot(uint256 day, address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (day >= currentDay()) revert DayNotEnded();
        if (rolled[day]) revert AlreadyRolled();
        rolled[day] = true;
        uint256 amount = pot[day];
        pot[day] = 0;
        token.safeTransfer(to, amount);
        emit UnrolledPotRecovered(day, to, amount);
    }

    // ============================================================
    //  Protocolo / administración (solo owner)
    // ============================================================

    /// @notice El owner retira la comisión de protocolo acumulada (no toca los pots).
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

    function setFees(uint256 attemptFee_, uint256 protocolBps_) external onlyOwner {
        if (protocolBps_ > 10_000) revert InvalidBps();
        attemptFee = attemptFee_;
        protocolBps = protocolBps_;
        emit FeesUpdated(attemptFee_, protocolBps_);
    }

    /// @notice Configura el precio de un tipo de pista. Ponerlo en 0 la deshabilita.
    function setHintFee(uint8 hintType, uint256 fee) external onlyOwner {
        hintFee[hintType] = fee;
        emit HintFeeUpdated(hintType, fee);
    }
}
