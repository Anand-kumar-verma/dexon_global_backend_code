"user-strict";
const express = require("express");
const { userLogin, userRegistration, adminLogin, dappUserLogin } = require("../auth");
const { getDistributorNameById, member_topup_by_admin, ZPpayInRequest_Dummy_Entry, ZPpayInRequest, userActivationFromSpotWallet, getReportDeails, getRewardAchieversList, claimedReward, memberPayout, withdrawalApprovalFromAdmin, getMemberPayoutReport, memberDashboard, memberCompounding, claimIncome, createUserWallet, perFormTransactoin, chaimPendingTransaction, getPendingWalletHistory, getDownlineTeamTree, getDownlineTeamTreeAdmin, getDownlineTeam, totalLevelWiseMember, updateMemberProfile, getMasterData, updateGeneralStatus, getMemberDetail, getMemberListByAdmin, admin_dashboard, getMemberDashboard, fundTransferP2P, memberDashboardBusiness, getNewsAndUpdated, updateNewsAndUpdated, updateNewsAndUpdatedStatus, createTradePair, updateTradePairStatus, deleteTradePair, getGlobalPayoutHisatory, member_global_live_transacton_activity, getTradePair } = require("../controllers/controller");
const { checkAuth, isAdmin } = require("../middleware");
const { getMyTrades } = require("../controllers/trade_controller");


const router = express.Router();

//////////////// teleroi project //////////////////////////////////
router.post("/member-login", userLogin);
router.post("/member-dapp-log-reg", dappUserLogin);
router.post("/admin-login", adminLogin);

router.post("/member-registration", userRegistration);
router.post("/member-name-by-cust-id", getDistributorNameById);
router.get("/member-profile-details", checkAuth, getMemberDetail);
router.get("/member-dashboard-details", checkAuth, getMemberDashboard);

router.post(
  "/member-topup-by-admin",
  checkAuth,
  isAdmin,
  member_topup_by_admin,
);
router.post(
  "/member-fund-transfer-p2p",
  checkAuth,
  fundTransferP2P,
);
router.post("/get-topup-qr", checkAuth, createUserWallet);
router.get("/member-self-topup", checkAuth, perFormTransactoin);
router.post(
  "/member-claim-pending-transaction",
  checkAuth,
  chaimPendingTransaction,
);

// router.post("/user-payin-dummy", checkAuth, ZPpayInRequest_Dummy_Entry);
// router.post("/user-payin-req", checkAuth, ZPpayInRequest);
router.post("/claimed-income", checkAuth, claimIncome);

router.post(
  "/user-activation-from-spot-wallet",
  checkAuth,
  userActivationFromSpotWallet,
);
router.post("/get-report-details", checkAuth, getReportDeails);
router.post("/get-global-payout-history", checkAuth, getGlobalPayoutHisatory);
router.post("/get-reward-achievers-list", checkAuth, getRewardAchieversList);
router.post("/claimed-reward", checkAuth, claimedReward);
router.post("/member-payout", checkAuth, memberPayout);
router.post(
  "/withdrawal-approval-from-admin",
  checkAuth,
  isAdmin,
  withdrawalApprovalFromAdmin,
);
router.post("/member-payout-report", checkAuth, getMemberPayoutReport);
router.get("/member-dashboard", checkAuth, memberDashboard);
router.get("/member-dashboard-business", checkAuth, memberDashboardBusiness);
router.post("/member-compound-request", checkAuth, memberCompounding);

router.post("/member-wallet-transactions", checkAuth, getPendingWalletHistory);



router.get("/get-member-downline-tree", checkAuth, getDownlineTeamTree);

router.post("/get-member-downline", checkAuth, getDownlineTeam);
router.get("/get-level-wise-member", checkAuth, totalLevelWiseMember);
router.post("/change-member-profile-by-user", checkAuth, updateMemberProfile);
router.get("/get-master-data", getMasterData);
router.get("/get-news-and-updates", getNewsAndUpdated);
router.post("/update-news-and-updates", updateNewsAndUpdated);
router.post("/update-news-and-updates-status", updateNewsAndUpdatedStatus);

router.post("/udpate-master-data", checkAuth, isAdmin, updateGeneralStatus);
router.post("/member-details", checkAuth, isAdmin, getMemberListByAdmin);
router.get("/get-admin-dashboard", checkAuth, admin_dashboard);
router.get("/get-member-global-live-transaction-activity", checkAuth, member_global_live_transacton_activity);

router.get("/get-trades", checkAuth, getMyTrades);

// trading and pairs
router.post("/create-trade-pair", checkAuth, isAdmin, createTradePair);
router.post("/update-trade-pair-status", checkAuth, isAdmin, updateTradePairStatus);
router.post("/delete-trade-pair", checkAuth, isAdmin, deleteTradePair);
router.post("/get-trade-pair", checkAuth, isAdmin, getTradePair);

module.exports = router;