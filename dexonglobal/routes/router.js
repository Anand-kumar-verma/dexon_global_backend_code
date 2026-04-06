"use strict";
const express = require("express");
const { userLogin, userRegistration, adminLogin, dappUserLogin } = require("../auth");
const { getDistributorNameById, member_topup_by_admin, ZPpayInRequest_Dummy_Entry, ZPpayInRequest, userActivationFromSpotWallet, getReportDeails, getRewardAchieversList, claimedReward, memberPayout, withdrawalApprovalFromAdmin, getMemberPayoutReport, memberDashboard, memberCompounding, claimIncome, createUserWallet, perFormTransactoin, chaimPendingTransaction, getPendingWalletHistory, getDownlineTeamTree, getDownlineTeamTreeAdmin, getDownlineTeam, totalLevelWiseMember, updateMemberProfile, getMasterData, updateGeneralStatus, getMemberDetail, getMemberListByAdmin, admin_dashboard, getMemberDashboard, fundTransferP2P, memberDashboardBusiness, getNewsAndUpdated, updateNewsAndUpdated, updateNewsAndUpdatedStatus, createTradePair, updateTradePairStatus, deleteTradePair, getGlobalPayoutHisatory, member_global_live_transacton_activity, getTradePair, getPackageDetails, getPayoutCallback, updateTradeProfit, verifyTotp, withdrawalPermission, tradePermission, getMasterConfig, updateMasterData, getPayoutCallbackPayin, memberTopuCryptoFitpGateway } = require("../controllers/controller");
const { checkAuth, isAdmin, isAdminSubAdmin, checkPermission } = require("../middleware");
const { getMyTrades } = require("../controllers/trade_controller");
const { userMessage, adminReply, getMessaage } = require("../controllers/ticketAndSupport");
const { getSubAdminPermissions, updateSubAdminPermissions, getSubAdmins, getSubAdminById, toggleSubAdminStatus, toggleSubAdminAccess } = require("../controllers/subAdmin");

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.post("/member-login", userLogin);
router.post("/member-dapp-log-reg", dappUserLogin);
router.post("/admin-login", adminLogin);
router.post("/member-registration", userRegistration);
router.post("/member-name-by-cust-id", getDistributorNameById);

router.get("/get-news-and-updates", getNewsAndUpdated);
router.post("/payout-callback", getPayoutCallback);
router.post("/user-payin-crypto-fit", checkAuth, memberTopuCryptoFitpGateway);
router.post("/payin-callback", getPayoutCallbackPayin);

// ── Member ────────────────────────────────────────────────────────────────────
router.get("/member-profile-details", checkAuth, getMemberDetail);
router.get("/member-dashboard-details", checkAuth, getMemberDashboard);
router.post("/member-fund-transfer-p2p", checkAuth, fundTransferP2P);
router.post("/get-topup-qr", checkAuth, createUserWallet);
router.get("/member-self-topup", checkAuth, perFormTransactoin);
router.post("/member-claim-pending-transaction", checkAuth, chaimPendingTransaction);
router.post("/user-payin-dummy", checkAuth, ZPpayInRequest_Dummy_Entry);
router.post("/user-payin-req", checkAuth, ZPpayInRequest);
router.post("/claimed-income", checkAuth, claimIncome);
router.post("/user-activation-from-spot-wallet", checkAuth, userActivationFromSpotWallet);
router.post("/get-report-details", checkAuth, getReportDeails);
router.post("/get-global-payout-history", checkAuth, getGlobalPayoutHisatory);
router.post("/get-reward-achievers-list", checkAuth, getRewardAchieversList);
router.post("/claimed-reward", checkAuth, claimedReward);
router.post("/member-payout", checkAuth, memberPayout);
router.post("/member-payout-report", checkAuth, getMemberPayoutReport);
router.get("/member-dashboard", checkAuth, memberDashboard);
router.get("/member-dashboard-business", checkAuth, memberDashboardBusiness);
router.post("/member-compound-request", checkAuth, memberCompounding);
router.post("/member-wallet-transactions", checkAuth, getPendingWalletHistory);
router.get("/get-member-downline-tree", checkAuth, getDownlineTeamTree);
router.post("/get-member-downline", checkAuth, getDownlineTeam);
router.get("/get-level-wise-member", checkAuth, totalLevelWiseMember);
router.post("/change-member-profile-by-user", checkAuth, updateMemberProfile);
router.post("/update-news-and-updates", checkAuth, updateNewsAndUpdated);
router.post("/update-news-and-updates-status", checkAuth, updateNewsAndUpdatedStatus);
router.get("/get-trades", checkAuth, getMyTrades);
router.get("/get-package-details", checkAuth, getPackageDetails);
router.post("/user-message", checkAuth, userMessage);
router.post("/get-user-messages", checkAuth, getMessaage);



// ── Admin / SubAdmin READ ─────────────────────────────────────────────────────
router.get("/get-admin-dashboard", checkAuth, isAdminSubAdmin, admin_dashboard);
router.get("/get-member-global-live-transaction-activity", checkAuth, isAdminSubAdmin, member_global_live_transacton_activity);
router.post("/member-details", checkAuth, isAdminSubAdmin, getMemberListByAdmin);
router.post("/get-trade-pair", checkAuth, isAdminSubAdmin, getTradePair);

// ── Admin / SubAdmin WRITE — Fund ─────────────────────────────────────────────
router.post("/member-topup-by-admin", checkAuth, isAdminSubAdmin, checkPermission("fund.topup"), member_topup_by_admin);
router.post("/withdrawal-approval-from-admin", checkAuth, isAdminSubAdmin, checkPermission("fund.withdrawal_approve"), withdrawalApprovalFromAdmin);
router.post("/member-withd-perm", checkAuth, isAdminSubAdmin, checkPermission("fund.withdrawal_toggle"), withdrawalPermission);

// ── Admin / SubAdmin WRITE — Trade ───────────────────────────────────────────
router.post("/create-trade-pair", checkAuth, isAdminSubAdmin, checkPermission("trade.create"), createTradePair);
router.post("/update-trade-pair-status", checkAuth, isAdminSubAdmin, checkPermission("trade.update_status"), updateTradePairStatus);
router.post("/delete-trade-pair", checkAuth, isAdminSubAdmin, checkPermission("trade.delete"), deleteTradePair);
router.post("/member-trade-perm", checkAuth, isAdminSubAdmin, checkPermission("trade.toggle_permission"), tradePermission);
router.post("/update-trade-profit", checkAuth, isAdminSubAdmin, checkPermission("trade.update_profit"), updateTradeProfit);
router.get("/get-master-data",checkAuth,isAdminSubAdmin, getMasterData);

// ── Admin / SubAdmin WRITE — Tickets ─────────────────────────────────────────
router.post("/admin-reply", checkAuth, isAdminSubAdmin, checkPermission("tickets.reply"), adminReply);

// ── Admin only ────────────────────────────────────────────────────────────────
router.post("/udpate-master-data", checkAuth, isAdmin, updateGeneralStatus);
router.post("/verify_totp", checkAuth, isAdmin, verifyTotp);

router.get("/get-subadmins", checkAuth, isAdmin, getSubAdmins);
router.post("/update-subadmin-permissions", checkAuth, isAdmin, updateSubAdminPermissions);
router.post("/toggle-subadmin-status", checkAuth, isAdmin, toggleSubAdminStatus);
router.post("/toggle-subadmin-access", checkAuth, isAdmin, toggleSubAdminAccess);
router.post("/update-master-data",checkAuth,isAdmin, updateMasterData);


module.exports = router;