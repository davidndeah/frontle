// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {FrontleGame} from "../src/FrontleGame.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract FrontleGameTest is Test {
    FrontleGame internal game;
    MockERC20 internal token;

    // owner = address(this) (este contrato despliega el juego en setUp)
    address internal operator = makeAddr("operator");
    address internal player = makeAddr("player");
    address internal stranger = makeAddr("stranger");
    address internal treasury = makeAddr("treasury");

    // Ganadores por nivel
    address internal hardW = makeAddr("hardWinner");
    address internal medW = makeAddr("medWinner");
    address internal easyW = makeAddr("easyWinner");

    uint256 internal constant ATTEMPT_FEE = 0.10 ether;
    uint256 internal constant PROTOCOL_BPS = 2000; // 20%

    uint8 internal constant HINT_INITIAL = 0;
    uint8 internal constant HINT_NEXT = 1;
    uint8 internal constant HINT_ALL = 2;
    uint256 internal constant FEE_INITIAL = 0.05 ether;
    uint256 internal constant FEE_ALL = 0.10 ether;

    // Niveles (espejo de las constantes del contrato)
    uint8 internal constant L_EASY = 0;
    uint8 internal constant L_MEDIUM = 1;
    uint8 internal constant L_HARD = 2;

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

    function setUp() public {
        // timestamp realista para que currentDay() > 0 y se pueda cerrar un día previo
        vm.warp(1_750_000_000); // ~jun 2025
        token = new MockERC20("Mock USD", "mUSD", 18);
        game = new FrontleGame(address(token), operator, ATTEMPT_FEE, PROTOCOL_BPS);
        game.setHintFee(HINT_INITIAL, FEE_INITIAL);
        game.setHintFee(HINT_NEXT, FEE_INITIAL);
        game.setHintFee(HINT_ALL, FEE_ALL);

        token.mint(player, 100 ether);
        vm.prank(player);
        token.approve(address(game), type(uint256).max);

        token.mint(address(this), 1_000 ether);
        token.approve(address(game), type(uint256).max);
    }

    function _today() internal view returns (uint256) {
        return block.timestamp / 1 days;
    }

    /// @dev Siembra `amount` en el pot del día actual y devuelve el índice del día,
    ///      ya con el día terminado (warp +1) listo para rollDay.
    function _seedAndEndDay(uint256 amount) internal returns (uint256 day) {
        day = _today();
        game.fundPot(amount);
        vm.warp(block.timestamp + 1 days);
    }

    // ------------------------------------------------------------
    //  Constructor
    // ------------------------------------------------------------

    function test_Constructor_SetsState() public view {
        assertEq(address(game.token()), address(token));
        assertEq(game.operator(), operator);
        assertEq(game.attemptFee(), ATTEMPT_FEE);
        assertEq(game.protocolBps(), PROTOCOL_BPS);
        assertEq(game.owner(), address(this));
    }

    function test_Constructor_RevertOnZeroToken() public {
        vm.expectRevert(FrontleGame.ZeroAddress.selector);
        new FrontleGame(address(0), operator, ATTEMPT_FEE, PROTOCOL_BPS);
    }

    function test_Constructor_RevertOnZeroOperator() public {
        vm.expectRevert(FrontleGame.ZeroAddress.selector);
        new FrontleGame(address(token), address(0), ATTEMPT_FEE, PROTOCOL_BPS);
    }

    function test_Constructor_RevertOnInvalidBps() public {
        vm.expectRevert(FrontleGame.InvalidBps.selector);
        new FrontleGame(address(token), operator, ATTEMPT_FEE, 10_001);
    }

    function test_CurrentDay_MatchesUtcDayIndex() public view {
        assertEq(game.currentDay(), block.timestamp / 1 days);
    }

    // ------------------------------------------------------------
    //  payAttempt — split protocolo / pot
    // ------------------------------------------------------------

    function test_PayAttempt_SplitsBetweenPotAndProtocol() public {
        uint256 day = _today();

        vm.expectEmit(true, true, false, true);
        emit AttemptPaid(player, day, ATTEMPT_FEE);

        vm.prank(player);
        game.payAttempt();

        uint256 protocolCut = (ATTEMPT_FEE * PROTOCOL_BPS) / 10_000; // 0.02
        assertEq(game.protocolAccrued(), protocolCut);
        assertEq(game.pot(day), ATTEMPT_FEE - protocolCut); // 0.08
        assertEq(token.balanceOf(address(game)), ATTEMPT_FEE);
    }

    function test_PayAttempt_RevertWhenNoAllowance() public {
        vm.prank(player);
        token.approve(address(game), 0);
        vm.prank(player);
        vm.expectRevert();
        game.payAttempt();
    }

    // ------------------------------------------------------------
    //  buyHint — precio por tipo
    // ------------------------------------------------------------

    function test_BuyHint_ChargesPriceForTypeAndSplits() public {
        uint256 day = _today();

        vm.expectEmit(true, true, false, true);
        emit HintPaid(player, day, HINT_ALL, FEE_ALL);

        vm.prank(player);
        game.buyHint(HINT_ALL);

        uint256 protocolCut = (FEE_ALL * PROTOCOL_BPS) / 10_000;
        assertEq(game.pot(day), FEE_ALL - protocolCut);
        assertEq(game.protocolAccrued(), protocolCut);
    }

    function test_BuyHint_RevertWhenTypeNotConfigured() public {
        vm.prank(player);
        vm.expectRevert(FrontleGame.HintNotConfigured.selector);
        game.buyHint(9);
    }

    // ------------------------------------------------------------
    //  fundPot — siembra 100% al pot
    // ------------------------------------------------------------

    function test_FundPot_AllGoesToPot() public {
        uint256 day = _today();

        vm.expectEmit(true, true, false, true);
        emit PotFunded(day, address(this), 5 ether);

        game.fundPot(5 ether);
        assertEq(game.pot(day), 5 ether);
        assertEq(game.protocolAccrued(), 0);
    }

    // ------------------------------------------------------------
    //  rollDay — reparto por niveles (_computeShares)
    // ------------------------------------------------------------

    function test_RollDay_AllThree_50_35_15() public {
        uint256 day = _seedAndEndDay(100 ether);

        vm.expectEmit(true, false, false, true);
        emit DayRolled(day, hardW, medW, easyW, 100 ether);

        vm.prank(operator);
        game.rollDay(day, hardW, medW, easyW);

        assertTrue(game.rolled(day));
        assertEq(game.prize(day, L_HARD), 50 ether);
        assertEq(game.prize(day, L_MEDIUM), 35 ether);
        assertEq(game.prize(day, L_EASY), 15 ether);
        assertEq(game.winnerOf(day, L_HARD), hardW);
        assertEq(game.winnerOf(day, L_MEDIUM), medW);
        assertEq(game.winnerOf(day, L_EASY), easyW);
    }

    function test_RollDay_NoEasy_50_50() public {
        uint256 day = _seedAndEndDay(100 ether);
        vm.prank(operator);
        game.rollDay(day, hardW, medW, address(0)); // falta fácil

        assertEq(game.prize(day, L_HARD), 50 ether);
        assertEq(game.prize(day, L_MEDIUM), 50 ether);
        assertEq(game.prize(day, L_EASY), 0);
        assertEq(game.winnerOf(day, L_EASY), address(0));
    }

    function test_RollDay_NoMedium_85_15() public {
        uint256 day = _seedAndEndDay(100 ether);
        vm.prank(operator);
        game.rollDay(day, hardW, address(0), easyW); // falta medio

        assertEq(game.prize(day, L_HARD), 85 ether);
        assertEq(game.prize(day, L_EASY), 15 ether);
        assertEq(game.prize(day, L_MEDIUM), 0);
    }

    function test_RollDay_NoHard_75_25() public {
        uint256 day = _seedAndEndDay(100 ether);
        vm.prank(operator);
        game.rollDay(day, address(0), medW, easyW); // falta difícil (regla equipo)

        assertEq(game.prize(day, L_MEDIUM), 75 ether);
        assertEq(game.prize(day, L_EASY), 25 ether);
        assertEq(game.prize(day, L_HARD), 0);
    }

    function test_RollDay_OnlyHard_100() public {
        uint256 day = _seedAndEndDay(100 ether);
        vm.prank(operator);
        game.rollDay(day, hardW, address(0), address(0));
        assertEq(game.prize(day, L_HARD), 100 ether);
    }

    function test_RollDay_OnlyMedium_100() public {
        uint256 day = _seedAndEndDay(100 ether);
        vm.prank(operator);
        game.rollDay(day, address(0), medW, address(0));
        assertEq(game.prize(day, L_MEDIUM), 100 ether);
    }

    function test_RollDay_OnlyEasy_100() public {
        uint256 day = _seedAndEndDay(100 ether);
        vm.prank(operator);
        game.rollDay(day, address(0), address(0), easyW);
        assertEq(game.prize(day, L_EASY), 100 ether);
    }

    function test_RollDay_RevertWhenNoWinners() public {
        uint256 day = _seedAndEndDay(100 ether);
        vm.prank(operator);
        vm.expectRevert(FrontleGame.NoWinners.selector);
        game.rollDay(day, address(0), address(0), address(0));
    }

    function test_RollDay_RevertWhenNotOperator() public {
        uint256 day = _today();
        vm.warp(block.timestamp + 1 days);
        vm.prank(stranger);
        vm.expectRevert(FrontleGame.NotOperator.selector);
        game.rollDay(day, hardW, medW, easyW);
    }

    function test_RollDay_RevertWhenDayNotEnded() public {
        vm.prank(operator);
        vm.expectRevert(FrontleGame.DayNotEnded.selector);
        game.rollDay(_today(), hardW, medW, easyW); // día en curso
    }

    function test_RollDay_RevertOnDoubleRoll() public {
        uint256 day = _seedAndEndDay(100 ether);
        vm.prank(operator);
        game.rollDay(day, hardW, medW, easyW);
        vm.prank(operator);
        vm.expectRevert(FrontleGame.AlreadyRolled.selector);
        game.rollDay(day, hardW, medW, easyW);
    }

    // ------------------------------------------------------------
    //  claim — por nivel
    // ------------------------------------------------------------

    function test_Claim_EachWinnerTakesTheirShare() public {
        uint256 day = _seedAndEndDay(100 ether);
        vm.prank(operator);
        game.rollDay(day, hardW, medW, easyW);

        vm.expectEmit(true, true, true, true);
        emit Claimed(day, L_HARD, hardW, 50 ether);
        vm.prank(hardW);
        game.claim(day, L_HARD);

        vm.prank(medW);
        game.claim(day, L_MEDIUM);
        vm.prank(easyW);
        game.claim(day, L_EASY);

        assertEq(token.balanceOf(hardW), 50 ether);
        assertEq(token.balanceOf(medW), 35 ether);
        assertEq(token.balanceOf(easyW), 15 ether);
        assertTrue(game.claimed(day, L_HARD));
        assertTrue(game.claimed(day, L_MEDIUM));
        assertTrue(game.claimed(day, L_EASY));
        assertEq(token.balanceOf(address(game)), 0); // pot repartido por completo
    }

    function test_Claim_RevertWhenNotRolled() public {
        vm.prank(hardW);
        vm.expectRevert(FrontleGame.NotRolled.selector);
        game.claim(_today(), L_HARD);
    }

    function test_Claim_RevertOnInvalidLevel() public {
        uint256 day = _seedAndEndDay(100 ether);
        vm.prank(operator);
        game.rollDay(day, hardW, medW, easyW);
        vm.prank(hardW);
        vm.expectRevert(FrontleGame.InvalidLevel.selector);
        game.claim(day, 3);
    }

    function test_Claim_RevertWhenNotWinner() public {
        uint256 day = _seedAndEndDay(100 ether);
        vm.prank(operator);
        game.rollDay(day, hardW, medW, easyW);

        // stranger intenta cobrar el nivel difícil
        vm.prank(stranger);
        vm.expectRevert(FrontleGame.NotWinner.selector);
        game.claim(day, L_HARD);
    }

    function test_Claim_RevertWhenLevelHadNoWinner() public {
        uint256 day = _seedAndEndDay(100 ether);
        vm.prank(operator);
        game.rollDay(day, hardW, medW, address(0)); // fácil sin ganador

        // nadie puede cobrar el nivel fácil (winnerOf == address(0))
        vm.prank(easyW);
        vm.expectRevert(FrontleGame.NotWinner.selector);
        game.claim(day, L_EASY);
    }

    function test_Claim_RevertOnDoubleClaim() public {
        uint256 day = _seedAndEndDay(100 ether);
        vm.prank(operator);
        game.rollDay(day, hardW, medW, easyW);

        vm.prank(hardW);
        game.claim(day, L_HARD);
        vm.prank(hardW);
        vm.expectRevert(FrontleGame.AlreadyClaimed.selector);
        game.claim(day, L_HARD);
    }

    // ------------------------------------------------------------
    //  recoverUnrolledPot — días sin ganador
    // ------------------------------------------------------------

    function test_RecoverUnrolledPot_OwnerRecovers() public {
        uint256 day = _seedAndEndDay(7 ether);

        vm.expectEmit(true, true, false, true);
        emit UnrolledPotRecovered(day, treasury, 7 ether);

        game.recoverUnrolledPot(day, treasury);
        assertEq(token.balanceOf(treasury), 7 ether);
        assertEq(game.pot(day), 0);
        assertTrue(game.rolled(day));
    }

    function test_RecoverUnrolledPot_BlocksLaterRoll() public {
        uint256 day = _seedAndEndDay(7 ether);
        game.recoverUnrolledPot(day, treasury);
        vm.prank(operator);
        vm.expectRevert(FrontleGame.AlreadyRolled.selector);
        game.rollDay(day, hardW, medW, easyW);
    }

    function test_RecoverUnrolledPot_RevertWhenNotOwner() public {
        uint256 day = _seedAndEndDay(7 ether);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        game.recoverUnrolledPot(day, treasury);
    }

    function test_RecoverUnrolledPot_RevertWhenDayNotEnded() public {
        game.fundPot(7 ether);
        vm.expectRevert(FrontleGame.DayNotEnded.selector);
        game.recoverUnrolledPot(_today(), treasury);
    }

    // ------------------------------------------------------------
    //  withdrawProtocol
    // ------------------------------------------------------------

    function test_WithdrawProtocol_OwnerPullsAccrued() public {
        vm.prank(player);
        game.payAttempt(); // genera protocolAccrued = 0.02
        uint256 accrued = game.protocolAccrued();

        vm.expectEmit(true, false, false, true);
        emit ProtocolWithdrawn(treasury, accrued);

        game.withdrawProtocol(treasury, accrued);
        assertEq(token.balanceOf(treasury), accrued);
        assertEq(game.protocolAccrued(), 0);
    }

    function test_WithdrawProtocol_RevertWhenExceedsAccrued() public {
        vm.expectRevert(FrontleGame.InsufficientProtocol.selector);
        game.withdrawProtocol(treasury, 1 ether);
    }

    function test_WithdrawProtocol_RevertWhenNotOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        game.withdrawProtocol(stranger, 0);
    }

    function test_WithdrawProtocol_RevertOnZeroTo() public {
        vm.expectRevert(FrontleGame.ZeroAddress.selector);
        game.withdrawProtocol(address(0), 0);
    }

    // ------------------------------------------------------------
    //  Administración
    // ------------------------------------------------------------

    function test_SetOperator_UpdatesAndEmits() public {
        address newOp = makeAddr("newOp");
        vm.expectEmit(true, false, false, false);
        emit OperatorUpdated(newOp);
        game.setOperator(newOp);
        assertEq(game.operator(), newOp);
    }

    function test_SetOperator_RevertWhenNotOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        game.setOperator(stranger);
    }

    function test_SetOperator_RevertOnZero() public {
        vm.expectRevert(FrontleGame.ZeroAddress.selector);
        game.setOperator(address(0));
    }

    function test_SetFees_UpdatesBoth() public {
        vm.expectEmit(false, false, false, true);
        emit FeesUpdated(1 ether, 1000);
        game.setFees(1 ether, 1000);
        assertEq(game.attemptFee(), 1 ether);
        assertEq(game.protocolBps(), 1000);
    }

    function test_SetFees_RevertOnInvalidBps() public {
        vm.expectRevert(FrontleGame.InvalidBps.selector);
        game.setFees(1 ether, 10_001);
    }

    function test_SetFees_RevertWhenNotOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        game.setFees(1, 1);
    }

    function test_SetHintFee_UpdatesAndEmits() public {
        vm.expectEmit(true, false, false, true);
        emit HintFeeUpdated(HINT_ALL, 0.20 ether);
        game.setHintFee(HINT_ALL, 0.20 ether);
        assertEq(game.hintFee(HINT_ALL), 0.20 ether);
    }

    function test_SetHintFee_RevertWhenNotOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        game.setHintFee(HINT_ALL, 1 ether);
    }

    // ------------------------------------------------------------
    //  Fuzz: el split de pago siempre conserva el total (pot + protocolo = fee)
    // ------------------------------------------------------------

    function testFuzz_Collect_ConservesTotal(uint96 fee, uint16 bps) public {
        vm.assume(fee <= 100 ether);
        bps = uint16(bound(bps, 0, 10_000));
        game.setFees(fee, bps);
        uint256 day = _today();

        vm.prank(player);
        game.payAttempt();

        assertEq(game.pot(day) + game.protocolAccrued(), fee);
    }

    // ------------------------------------------------------------
    //  Fuzz: el reparto por niveles siempre conserva el pot completo
    //  (sin importar qué combinación de niveles tenga ganador)
    // ------------------------------------------------------------

    function testFuzz_Roll_ConservesPot(uint96 potAmount, bool hasHard, bool hasMed, bool hasEasy) public {
        potAmount = uint96(bound(potAmount, 1, 1_000 ether));
        vm.assume(hasHard || hasMed || hasEasy); // al menos un ganador

        uint256 day = _seedAndEndDay(potAmount);

        vm.prank(operator);
        game.rollDay(
            day,
            hasHard ? hardW : address(0),
            hasMed ? medW : address(0),
            hasEasy ? easyW : address(0)
        );

        uint256 sum = game.prize(day, L_HARD) + game.prize(day, L_MEDIUM) + game.prize(day, L_EASY);
        assertEq(sum, potAmount); // nada de polvo perdido
    }
}
