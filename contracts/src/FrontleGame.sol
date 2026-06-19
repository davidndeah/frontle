// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// ============================================================
//  FrontleGame — Pagos y pot diario (Celo)
//
//  Modelo (inspirado en FreakingPot.sol del tutor): POT DIARIO winner-takes-all.
//   - Intento extra y pistas: el jugador paga en stablecoin.
//     De cada pago, `protocolBps` va al protocolo y el resto al POT del día.
//   - rollDay(day, winner): el backend (operator) cierra un día ya terminado
//     y asigna su pot al ganador (calculado off-chain por el leaderboard).
//   - claim(day): el ganador retira el pot de ese día.
//   - fundPot: la plataforma puede sembrar el pot del día (premio base).
//
//  El "día" se deriva ON-CHAIN de block.timestamp (UTC) → el cliente no puede
//  falsearlo, y coincide con el reto diario del frontend (fecha UTC).
//
//  ⚠️ Nota de cumplimiento: el modelo winner-takes-all reparte el dinero de los
//  jugadores hacia el ganador. Esto puede considerarse apuesta y MiniPay lo
//  restringe. Decisión del equipo (17-jun): se usa este modelo según la guía
//  de producto (contracts/README.md).
// ============================================================

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract FrontleGame is Ownable {
    using SafeERC20 for IERC20;

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
    /// @notice Ganador asignado a cada día (tras rollDay).
    mapping(uint256 => address) public winnerOf;
    /// @notice Si el día ya fue cerrado por el operator.
    mapping(uint256 => bool) public rolled;
    /// @notice Si el pot del día ya fue reclamado.
    mapping(uint256 => bool) public claimed;
    /// @notice Comisión de protocolo acumulada y aún no retirada.
    uint256 public protocolAccrued;

    error NotOperator();
    error ZeroAddress();
    error HintNotConfigured();
    error InvalidBps();
    error DayNotEnded();
    error AlreadyRolled();
    error NotRolled();
    error NotWinner();
    error AlreadyClaimed();
    error InsufficientProtocol();

    event AttemptPaid(address indexed player, uint256 indexed day, uint256 amount);
    event HintPaid(address indexed player, uint256 indexed day, uint8 hintType, uint256 amount);
    event PotFunded(uint256 indexed day, address indexed from, uint256 amount);
    event DayRolled(uint256 indexed day, address indexed winner, uint256 pot);
    event Claimed(uint256 indexed day, address indexed winner, uint256 amount);
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

    /// @notice El operator cierra un día YA TERMINADO y le asigna ganador.
    function rollDay(uint256 day, address winner) external onlyOperator {
        if (winner == address(0)) revert ZeroAddress();
        if (day >= currentDay()) revert DayNotEnded();
        if (rolled[day]) revert AlreadyRolled();
        rolled[day] = true;
        winnerOf[day] = winner;
        emit DayRolled(day, winner, pot[day]);
    }

    /// @notice El ganador del día reclama su pot. Checks-effects-interactions.
    function claim(uint256 day) external {
        if (!rolled[day]) revert NotRolled();
        if (msg.sender != winnerOf[day]) revert NotWinner();
        if (claimed[day]) revert AlreadyClaimed();
        claimed[day] = true; // effect
        uint256 amount = pot[day];
        token.safeTransfer(msg.sender, amount); // interaction
        emit Claimed(day, msg.sender, amount);
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
