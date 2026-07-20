// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {FrontleWeekly} from "../src/FrontleWeekly.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract FrontleWeeklyTest is Test {
    FrontleWeekly internal weekly;
    MockERC20 internal token;

    address internal operator = makeAddr("operator");
    address internal player = makeAddr("player");
    address internal stranger = makeAddr("stranger");
    address internal treasury = makeAddr("treasury");

    address internal w1 = makeAddr("first");
    address internal w2 = makeAddr("second");
    address internal w3 = makeAddr("third");

    uint256 internal constant MIN_PURCHASE = 0.10 ether;
    uint256 internal constant PROTOCOL_BPS = 1000; // 10%

    uint8 internal constant P1 = 1;
    uint8 internal constant P2 = 2;
    uint8 internal constant P3 = 3;

    event CoinsPurchased(address indexed player, uint256 indexed week, uint256 amount);
    event PotFunded(uint256 indexed week, address indexed from, uint256 amount);
    event WeekRolled(uint256 indexed week, address first, address second, address third, uint256 pot);
    event RolledOver(uint256 indexed fromWeek, uint256 indexed toWeek, uint256 amount);
    event Claimed(uint256 indexed week, uint8 indexed place, address indexed winner, uint256 amount);
    event UnrolledPotRecovered(uint256 indexed week, address indexed to, uint256 amount);

    function setUp() public {
        // Arrancamos en un timestamp realista para que currentWeek() sea > 0.
        vm.warp(1_780_000_000);
        token = new MockERC20("Test USD", "tUSD", 18);
        weekly = new FrontleWeekly(address(token), operator, MIN_PURCHASE, PROTOCOL_BPS);
        token.mint(player, 100 ether);
        token.mint(address(this), 100 ether);
        vm.prank(player);
        token.approve(address(weekly), type(uint256).max);
        token.approve(address(weekly), type(uint256).max);
    }

    function _nextWeek() internal {
        vm.warp(block.timestamp + 7 days);
    }

    // --- semana UTC ---------------------------------------------------------

    /// La semana debe cambiar exactamente al pasar un LUNES 00:00 UTC.
    function test_currentWeek_startsOnMonday() public {
        // 2026-07-20 00:00:00 UTC es lunes.
        uint256 monday = 1_784_505_600;
        vm.warp(monday - 1); // domingo 23:59:59
        uint256 before = weekly.currentWeek();
        vm.warp(monday); // lunes 00:00:00
        assertEq(weekly.currentWeek(), before + 1, "la semana debe avanzar el lunes");
        vm.warp(monday + 6 days + 23 hours);
        assertEq(weekly.currentWeek(), before + 1, "no debe avanzar dentro de la misma semana");
    }

    // --- compra de monedas --------------------------------------------------

    function test_buyCoins_fundsPotAndEmits() public {
        uint256 week = weekly.currentWeek();
        vm.expectEmit(true, true, false, true);
        emit CoinsPurchased(player, week, 1 ether);
        vm.prank(player);
        weekly.buyCoins(1 ether);

        assertEq(weekly.pot(week), 1 ether, "el 100% de la compra va al pot");
        assertEq(token.balanceOf(address(weekly)), 1 ether);
        assertEq(weekly.protocolAccrued(), 0, "el recaudo se toma al repartir, no al comprar");
    }

    function test_buyCoins_revertsBelowMinimum() public {
        vm.prank(player);
        vm.expectRevert(FrontleWeekly.AmountTooSmall.selector);
        weekly.buyCoins(MIN_PURCHASE - 1);
    }

    function test_fundPot_addsToCurrentWeek() public {
        uint256 week = weekly.currentWeek();
        vm.expectEmit(true, true, false, true);
        emit PotFunded(week, address(this), 5 ether);
        weekly.fundPot(5 ether);
        assertEq(weekly.pot(week), 5 ether);
    }

    // --- reparto ------------------------------------------------------------

    /// Podio completo: 50 / 30 / 10 + 10% de recaudo, sin sobras.
    function test_rollWeek_fullPodium() public {
        uint256 week = weekly.currentWeek();
        weekly.fundPot(10 ether);
        _nextWeek();

        vm.prank(operator);
        weekly.rollWeek(week, w1, w2, w3);

        assertEq(weekly.prize(week, P1), 5 ether, "1o = 50%");
        assertEq(weekly.prize(week, P2), 3 ether, "2o = 30%");
        assertEq(weekly.prize(week, P3), 1 ether, "3o = 10%");
        assertEq(weekly.protocolAccrued(), 1 ether, "recaudo = 10%");
        assertEq(weekly.pot(weekly.currentWeek()), 0, "sin sobras al rodar");
    }

    /// Puesto vacante: su parte NO se reparte, rueda a la semana siguiente.
    function test_rollWeek_vacantPlaceRollsOver() public {
        uint256 week = weekly.currentWeek();
        weekly.fundPot(10 ether);
        _nextWeek();

        vm.expectEmit(true, true, false, true);
        emit RolledOver(week, week + 1, 1 ether); // el 10% del 3er puesto
        vm.prank(operator);
        weekly.rollWeek(week, w1, w2, address(0));

        assertEq(weekly.prize(week, P1), 5 ether);
        assertEq(weekly.prize(week, P2), 3 ether);
        assertEq(weekly.prize(week, P3), 0);
        assertEq(weekly.protocolAccrued(), 1 ether);
        assertEq(weekly.pot(weekly.currentWeek()), 1 ether, "la parte vacante rueda");
    }

    /// Un solo participante: cobra su 50%, el resto (30+10) rueda.
    function test_rollWeek_onlyFirst() public {
        uint256 week = weekly.currentWeek();
        weekly.fundPot(10 ether);
        _nextWeek();

        vm.prank(operator);
        weekly.rollWeek(week, w1, address(0), address(0));

        assertEq(weekly.prize(week, P1), 5 ether);
        assertEq(weekly.protocolAccrued(), 1 ether);
        assertEq(weekly.pot(weekly.currentWeek()), 4 ether, "30% + 10% ruedan");
    }

    function test_rollWeek_revertsIfNotEnded() public {
        uint256 week = weekly.currentWeek();
        vm.prank(operator);
        vm.expectRevert(FrontleWeekly.WeekNotEnded.selector);
        weekly.rollWeek(week, w1, w2, w3);
    }

    function test_rollWeek_revertsIfNotOperator() public {
        uint256 week = weekly.currentWeek();
        _nextWeek();
        vm.prank(stranger);
        vm.expectRevert(FrontleWeekly.NotOperator.selector);
        weekly.rollWeek(week, w1, w2, w3);
    }

    function test_rollWeek_revertsTwice() public {
        uint256 week = weekly.currentWeek();
        weekly.fundPot(1 ether);
        _nextWeek();
        vm.startPrank(operator);
        weekly.rollWeek(week, w1, w2, w3);
        vm.expectRevert(FrontleWeekly.AlreadyRolled.selector);
        weekly.rollWeek(week, w1, w2, w3);
        vm.stopPrank();
    }

    function test_rollWeek_revertsWithNoWinners() public {
        uint256 week = weekly.currentWeek();
        _nextWeek();
        vm.prank(operator);
        vm.expectRevert(FrontleWeekly.NoWinners.selector);
        weekly.rollWeek(week, address(0), address(0), address(0));
    }

    /// El mismo jugador no puede ocupar dos puestos del podio.
    function test_rollWeek_revertsOnDuplicateWinner() public {
        uint256 week = weekly.currentWeek();
        weekly.fundPot(1 ether);
        _nextWeek();
        vm.startPrank(operator);
        vm.expectRevert(FrontleWeekly.DuplicateWinner.selector);
        weekly.rollWeek(week, w1, w1, w3);
        vm.expectRevert(FrontleWeekly.DuplicateWinner.selector);
        weekly.rollWeek(week, w1, w2, w1);
        vm.expectRevert(FrontleWeekly.DuplicateWinner.selector);
        weekly.rollWeek(week, w1, w2, w2);
        vm.stopPrank();
    }

    // --- reclamo ------------------------------------------------------------

    function test_claim_paysWinnerOnce() public {
        uint256 week = weekly.currentWeek();
        weekly.fundPot(10 ether);
        _nextWeek();
        vm.prank(operator);
        weekly.rollWeek(week, w1, w2, w3);

        vm.expectEmit(true, true, true, true);
        emit Claimed(week, P1, w1, 5 ether);
        vm.prank(w1);
        weekly.claim(week, P1);
        assertEq(token.balanceOf(w1), 5 ether);

        vm.prank(w1);
        vm.expectRevert(FrontleWeekly.AlreadyClaimed.selector);
        weekly.claim(week, P1);
    }

    function test_claim_revertsForNonWinner() public {
        uint256 week = weekly.currentWeek();
        weekly.fundPot(10 ether);
        _nextWeek();
        vm.prank(operator);
        weekly.rollWeek(week, w1, w2, w3);

        vm.prank(stranger);
        vm.expectRevert(FrontleWeekly.NotWinner.selector);
        weekly.claim(week, P1);
    }

    function test_claim_revertsBeforeRoll() public {
        uint256 week = weekly.currentWeek();
        vm.prank(w1);
        vm.expectRevert(FrontleWeekly.NotRolled.selector);
        weekly.claim(week, P1);
    }

    function test_claim_revertsOnInvalidPlace() public {
        uint256 week = weekly.currentWeek();
        weekly.fundPot(1 ether);
        _nextWeek();
        vm.prank(operator);
        weekly.rollWeek(week, w1, w2, w3);
        vm.prank(w1);
        vm.expectRevert(FrontleWeekly.InvalidPlace.selector);
        weekly.claim(week, 4);
        vm.prank(w1);
        vm.expectRevert(FrontleWeekly.InvalidPlace.selector);
        weekly.claim(week, 0);
    }

    /// Los 3 ganadores cobran: el contrato queda solo con el recaudo.
    function test_allWinnersClaim_leavesOnlyProtocol() public {
        uint256 week = weekly.currentWeek();
        weekly.fundPot(10 ether);
        _nextWeek();
        vm.prank(operator);
        weekly.rollWeek(week, w1, w2, w3);

        vm.prank(w1);
        weekly.claim(week, P1);
        vm.prank(w2);
        weekly.claim(week, P2);
        vm.prank(w3);
        weekly.claim(week, P3);

        assertEq(token.balanceOf(address(weekly)), weekly.protocolAccrued(), "solo queda el recaudo");
    }

    // --- recuperación y administración --------------------------------------

    function test_recoverUnrolledPot() public {
        uint256 week = weekly.currentWeek();
        weekly.fundPot(4 ether);
        _nextWeek();

        vm.expectEmit(true, true, false, true);
        emit UnrolledPotRecovered(week, treasury, 4 ether);
        weekly.recoverUnrolledPot(week, treasury);

        assertEq(token.balanceOf(treasury), 4 ether);
        assertEq(weekly.pot(week), 0);

        // Ya cerrada: el operator no puede repartirla después.
        vm.prank(operator);
        vm.expectRevert(FrontleWeekly.AlreadyRolled.selector);
        weekly.rollWeek(week, w1, w2, w3);
    }

    function test_recoverUnrolledPot_onlyOwner() public {
        uint256 week = weekly.currentWeek();
        _nextWeek();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        weekly.recoverUnrolledPot(week, treasury);
    }

    function test_withdrawProtocol() public {
        uint256 week = weekly.currentWeek();
        weekly.fundPot(10 ether);
        _nextWeek();
        vm.prank(operator);
        weekly.rollWeek(week, w1, w2, w3);

        weekly.withdrawProtocol(treasury, 1 ether);
        assertEq(token.balanceOf(treasury), 1 ether);
        assertEq(weekly.protocolAccrued(), 0);

        vm.expectRevert(FrontleWeekly.InsufficientProtocol.selector);
        weekly.withdrawProtocol(treasury, 1);
    }

    /// El recaudo no puede tocar el dinero de los pots pendientes de reclamo.
    function test_withdrawProtocol_cannotDrainPots() public {
        uint256 week = weekly.currentWeek();
        weekly.fundPot(10 ether);
        _nextWeek();
        vm.prank(operator);
        weekly.rollWeek(week, w1, w2, w3);

        vm.expectRevert(FrontleWeekly.InsufficientProtocol.selector);
        weekly.withdrawProtocol(treasury, 2 ether); // solo hay 1 ether de recaudo
    }

    function test_setOperator_and_setParams() public {
        weekly.setOperator(stranger);
        assertEq(weekly.operator(), stranger);

        weekly.setParams(1 ether, 500);
        assertEq(weekly.minPurchase(), 1 ether);
        assertEq(weekly.protocolBps(), 500);

        vm.expectRevert(FrontleWeekly.InvalidBps.selector);
        weekly.setParams(1 ether, 10_001);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        weekly.setParams(1 ether, 100);
    }

    /// Un recaudo > 10% haría que 50+30+10+cut pasara del 100% y `rollWeek`
    /// revertiría por underflow, bloqueando el cierre. Debe ser imposible
    /// configurarlo, tanto al desplegar como después.
    function test_protocolBps_cappedAtTenPercent() public {
        assertEq(weekly.MAX_PROTOCOL_BPS(), 1000);

        vm.expectRevert(FrontleWeekly.InvalidBps.selector);
        new FrontleWeekly(address(token), operator, MIN_PURCHASE, 2000); // el 20% del contrato diario

        vm.expectRevert(FrontleWeekly.InvalidBps.selector);
        weekly.setParams(MIN_PURCHASE, 1001);

        weekly.setParams(MIN_PURCHASE, 1000); // el tope sí se admite
        assertEq(weekly.protocolBps(), 1000);
    }

    /// Con el recaudo en su tope, un podio completo sigue repartiendo sin
    /// revertir y sin dejar sobras.
    function test_fullPodium_atMaxProtocolBps() public {
        weekly.setParams(MIN_PURCHASE, 1000);
        uint256 week = weekly.currentWeek();
        weekly.fundPot(10 ether);
        _nextWeek();

        vm.prank(operator);
        weekly.rollWeek(week, w1, w2, w3);

        assertEq(weekly.prize(week, P1) + weekly.prize(week, P2) + weekly.prize(week, P3), 9 ether);
        assertEq(weekly.protocolAccrued(), 1 ether);
        assertEq(weekly.pot(weekly.currentWeek()), 0);
    }

    // --- invariante ---------------------------------------------------------

    /// Conservación: recaudo + premios + rollover == pot, para cualquier monto
    /// y cualquier combinación de puestos ocupados.
    function testFuzz_sharesConservePot(uint96 amount, bool has1, bool has2, bool has3) public {
        vm.assume(amount >= MIN_PURCHASE);
        vm.assume(has1 || has2 || has3);
        token.mint(address(this), amount);

        uint256 week = weekly.currentWeek();
        weekly.fundPot(amount);
        _nextWeek();

        vm.prank(operator);
        weekly.rollWeek(week, has1 ? w1 : address(0), has2 ? w2 : address(0), has3 ? w3 : address(0));

        uint256 paid = weekly.prize(week, P1) + weekly.prize(week, P2) + weekly.prize(week, P3);
        uint256 rolled = weekly.pot(weekly.currentWeek());
        assertEq(paid + weekly.protocolAccrued() + rolled, amount, "el pot debe conservarse exactamente");
    }

    /// Todo lo asignado como premio debe poder pagarse: el contrato nunca
    /// promete más de lo que custodia.
    function testFuzz_contractSolvency(uint96 amount) public {
        vm.assume(amount >= MIN_PURCHASE);
        token.mint(player, amount);

        uint256 week = weekly.currentWeek();
        vm.prank(player);
        weekly.buyCoins(amount);
        _nextWeek();
        vm.prank(operator);
        weekly.rollWeek(week, w1, w2, w3);

        vm.prank(w1);
        weekly.claim(week, P1);
        vm.prank(w2);
        weekly.claim(week, P2);
        vm.prank(w3);
        weekly.claim(week, P3);
        assertGe(token.balanceOf(address(weekly)), weekly.protocolAccrued());
    }
}
