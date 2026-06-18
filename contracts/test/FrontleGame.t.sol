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
    address internal winner = makeAddr("winner");
    address internal stranger = makeAddr("stranger");
    address internal treasury = makeAddr("treasury");

    uint256 internal constant ATTEMPT_FEE = 0.10 ether;
    uint256 internal constant PROTOCOL_BPS = 2000; // 20%

    uint8 internal constant HINT_INITIAL = 0;
    uint8 internal constant HINT_NEXT = 1;
    uint8 internal constant HINT_ALL = 2;
    uint256 internal constant FEE_INITIAL = 0.05 ether;
    uint256 internal constant FEE_ALL = 0.10 ether;

    event AttemptPaid(address indexed player, uint256 indexed day, uint256 amount);
    event HintPaid(address indexed player, uint256 indexed day, uint8 hintType, uint256 amount);
    event PotFunded(uint256 indexed day, address indexed from, uint256 amount);
    event DayRolled(uint256 indexed day, address indexed winner, uint256 pot);
    event Claimed(uint256 indexed day, address indexed winner, uint256 amount);
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

        token.mint(address(this), 100 ether);
        token.approve(address(game), type(uint256).max);
    }

    function _today() internal view returns (uint256) {
        return block.timestamp / 1 days;
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
    //  rollDay
    // ------------------------------------------------------------

    function test_RollDay_AssignsWinner() public {
        uint256 day = _today();
        vm.prank(player);
        game.payAttempt();

        vm.warp(block.timestamp + 1 days); // el día `day` ya terminó

        vm.expectEmit(true, true, false, true);
        emit DayRolled(day, winner, game.pot(day));

        vm.prank(operator);
        game.rollDay(day, winner);

        assertTrue(game.rolled(day));
        assertEq(game.winnerOf(day), winner);
    }

    function test_RollDay_RevertWhenNotOperator() public {
        uint256 day = _today();
        vm.warp(block.timestamp + 1 days);
        vm.prank(stranger);
        vm.expectRevert(FrontleGame.NotOperator.selector);
        game.rollDay(day, winner);
    }

    function test_RollDay_RevertWhenDayNotEnded() public {
        vm.prank(operator);
        vm.expectRevert(FrontleGame.DayNotEnded.selector);
        game.rollDay(_today(), winner); // día en curso
    }

    function test_RollDay_RevertOnZeroWinner() public {
        uint256 day = _today();
        vm.warp(block.timestamp + 1 days);
        vm.prank(operator);
        vm.expectRevert(FrontleGame.ZeroAddress.selector);
        game.rollDay(day, address(0));
    }

    function test_RollDay_RevertOnDoubleRoll() public {
        uint256 day = _today();
        vm.warp(block.timestamp + 1 days);
        vm.prank(operator);
        game.rollDay(day, winner);
        vm.prank(operator);
        vm.expectRevert(FrontleGame.AlreadyRolled.selector);
        game.rollDay(day, winner);
    }

    // ------------------------------------------------------------
    //  claim
    // ------------------------------------------------------------

    function test_Claim_WinnerTakesPot() public {
        uint256 day = _today();
        vm.prank(player);
        game.payAttempt();
        game.fundPot(1 ether); // premio base
        uint256 expectedPot = game.pot(day);

        vm.warp(block.timestamp + 1 days);
        vm.prank(operator);
        game.rollDay(day, winner);

        vm.expectEmit(true, true, false, true);
        emit Claimed(day, winner, expectedPot);

        vm.prank(winner);
        game.claim(day);

        assertEq(token.balanceOf(winner), expectedPot);
        assertTrue(game.claimed(day));
    }

    function test_Claim_RevertWhenNotRolled() public {
        vm.prank(winner);
        vm.expectRevert(FrontleGame.NotRolled.selector);
        game.claim(_today());
    }

    function test_Claim_RevertWhenNotWinner() public {
        uint256 day = _today();
        vm.warp(block.timestamp + 1 days);
        vm.prank(operator);
        game.rollDay(day, winner);

        vm.prank(stranger);
        vm.expectRevert(FrontleGame.NotWinner.selector);
        game.claim(day);
    }

    function test_Claim_RevertOnDoubleClaim() public {
        uint256 day = _today();
        game.fundPot(1 ether);
        vm.warp(block.timestamp + 1 days);
        vm.prank(operator);
        game.rollDay(day, winner);

        vm.prank(winner);
        game.claim(day);
        vm.prank(winner);
        vm.expectRevert(FrontleGame.AlreadyClaimed.selector);
        game.claim(day);
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
    //  Fuzz: el split siempre conserva el total (pot + protocolo = fee)
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
}
