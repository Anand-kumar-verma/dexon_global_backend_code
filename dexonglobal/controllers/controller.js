const { returnResponse } = require("../helper/helperResponse");
const { deCryptData, queryDb } = require("../helper/utilityHelper");
const ethers = require("ethers");
const moment = require("moment");
const { randomStrNumeric } = require("../helper/utilityHelper");
const QRCode = require("qrcode");
const jwt = require("jsonwebtoken");
const sequlize = require("../config/seq.config");
const crypto = require("crypto");
const axios = require("axios");
const { isValidEmail, isValidMobile } = require("../validation/validation");
require("dotenv").config();
const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)",
];

exports.getDistributorNameById = async (req, res, next) => {
    try {
        const { customer_id = "" } = req.body;

        if (!customer_id)
            return res
                .status(201)
                .json(returnResponse(false, true, "customer_id is required!"));
        const apiRes = await queryDb(
            "SELECT `lgn_name` FROM  `tr01_login_credential` WHERE `lgn_cust_id` = ? LIMIT 1;",
            [customer_id?.trim()],
        );
        return res
            .status(200)
            .json(
                returnResponse(true, false, "Get Customer Name successfully.", apiRes),
            );
    } catch (err) {
        next(err);
    }
};

exports.member_topup_by_admin = async (req, res, next) => {
    try {
        const {
            user_id,
            pkg_id = 1,
            pkg_amount = 0,
            wallet_type = "fund_wallet",// topup_wallet, fund_wallet
        } = req.body;
        if (!user_id || !pkg_id || !pkg_amount)
            return res
                .status(201)
                .json(returnResponse(false, true, "Everything is required", []));




        const getUserId = await queryDb(
            "SELECT `lgn_jnr_id` FROM `tr01_login_credential` WHERE `lgn_cust_id` = ? LIMIT 1;",
            [user_id?.trim()],
        );
        if (getUserId.length === 0)
            return res
                .status(201)
                .json(returnResponse(false, true, "Invalid User Id", []));
        if (wallet_type === "fund_wallet") {
            const cond = await queryDb("SELECT fn_payin_conditions(?,?) AS msg;", [
                Number(getUserId?.[0]?.lgn_jnr_id),
                Number(pkg_amount || 0),
            ]);
            if (cond?.[0]?.msg !== "1")
                return res
                    .status(201)
                    .json(returnResponse(false, true, cond?.[0]?.msg, []));

            let q = "CALL sp_member_topup(?,?,?,?,?,?,@res_msg);";

            let re = [
                Number(getUserId?.[0]?.lgn_jnr_id),
                randomStrNumeric(20),
                Number(pkg_amount),
                Number(pkg_id),
                "admin",
                "Topup by user admin",
            ];
            await queryDb(q, re);
            const resMsg = await queryDb("SELECT @res_msg as msg", []);
            return res
                .status(200)
                .json(returnResponse(true, false, resMsg?.[0]?.msg, []));
        } else {

            const fund_wallet = await queryDb("SELECT IFNULL(`tr03_fund_wallet`,0) AS fund_wallet FROM `tr03_user_details` WHERE `tr03_reg_id` = ? LIMIT 1;", [
                Number(getUserId?.[0]?.lgn_jnr_id)
            ]);
            let q = `
                    INSERT INTO tr07_manage_ledger(tr07_reg_id,tr07_trans_id,tr07_main_label,tr07_sub_label,tr07_open_bal,tr07_tr_amount,tr07_clos_bal,tr07_credit,tr07_description,tr07_help_id) 
                            VALUES(
                                ?,
                                ?,
                                'IN',
                                'FUND WALLET',
                                ?,
                                ?,
                                ?,
                                1,
                                'DEPOSIT FROM ADMIN',
                                ?
                                );
                            `;
            await queryDb(q, [
                Number(getUserId?.[0]?.lgn_jnr_id),
                randomStrNumeric(20),
                Number(fund_wallet?.[0]?.fund_wallet || 0),
                Number(pkg_amount),
                Number(fund_wallet?.[0]?.fund_wallet || 0) + Number(pkg_amount || 0),
                0,
            ]);

            return res
                .status(200)
                .json(
                    returnResponse(true, false, "Walet has created successfully.", []),
                );
        }
    } catch (err) {
        console.log(err);
        next(err);
    }
};
exports.fundTransferP2P = async (req, res, next) => {
    const fromUserID = req.userId;
    const role = req.role;
    try {

        const {
            to_cust_id,
            pkg_id = 1,
            pkg_amount = 0,
            wallet_type = "fund_wallet",// topup_wallet, fund_wallet
            transaction_type = "credit"// credit or debit 
        } = req.body;
        if (!to_cust_id || !pkg_amount)
            return res
                .status(201)
                .json(returnResponse(false, true, "Everything is required", []));

        const getUserId = await queryDb(
            "SELECT `lgn_jnr_id` FROM `tr01_login_credential` WHERE `lgn_cust_id` = ? LIMIT 1;",
            [to_cust_id?.trim()],
        );
        if (getUserId.length === 0)
            return res
                .status(201)
                .json(returnResponse(false, true, "Invalid User Id", []));
        let resMsg = [{ msg: "" }];
        if (transaction_type === "credit") {
            let q = "CALL sp_member_fund_transfer(?,?,?,?,?,?,?,@res_msg);"
            await queryDb(q, [
                Number(role === "Admin" ? 0 : fromUserID),
                Number(getUserId?.[0]?.lgn_jnr_id),
                wallet_type,
                Number(pkg_amount),
                Number(pkg_id),
                "admin",
                "Fund Transfer by admin",
            ]);
            resMsg = await queryDb("SELECT @res_msg as msg", []);

        } else if (transaction_type === "debit" && role === "Admin") {
            let q = "CALL sp_member_fund_transfer_debit(?,?,?,?,@res_msg1);"
            await queryDb(q, [
                Number(getUserId?.[0]?.lgn_jnr_id),
                wallet_type,
                Number(pkg_amount),
                "Fund Debited by admin",
            ]);
            resMsg = await queryDb("SELECT @res_msg1 as msg", []);
        }

        return res
            .status(200)
            .json(
                returnResponse(resMsg?.[0]?.msg === "Transactoin Successful", false, resMsg?.[0]?.msg || "Fund Transfer completed successfully.", []),
            );

    } catch (err) {
        console.log(err);
        next(err);
    }
};

exports.ZPpayInRequest_Dummy_Entry = async (req, res) => {
    const userid = req.userId;

    const { payload } = req.body;
    const decriptData = deCryptData(payload);
    const {
        market_price,
        req_amount,
        pkg_id,
        u_user_wallet_address,
        u_transaction_hash,
        u_trans_status,
        currentBNB,
        currentZP,
        gas_price,
    } = decriptData;
    try {
        const cond = await queryDb("SELECT fn_payin_conditions(?,?) AS msg;", [
            Number(userid),
            Number(req_amount || 0),
        ]);
        if (cond?.[0]?.msg !== "1")
            return res
                .status(201)
                .json(returnResponse(false, true, cond?.[0]?.msg, []));

        let tr_insert =
            "INSERT INTO `tr53_transactions_records`(`tr_trans_id`,`tr_user_id`,`tr_phid`,`tr_amount`,`tr_from_wallet`,`tr_req_params`) VALUES(?,?,?,?,?,?);";
        const last_id = await queryDb(tr_insert, [
            randomStrNumeric(10),
            Number(userid),
            Number(userid),
            Number(req_amount || 0),
            u_user_wallet_address,
            JSON.stringify(decriptData),
        ]);
        return res
            .status(200)
            .json(
                returnResponse(true, false, "Data Received Successfully.", [
                    { last_id: last_id },
                ]),
            );
    } catch (e) {
        return res
            .status(201)
            .json(
                returnResponse(false, true, "Something went worng in node api", [
                    { last_id: 0 },
                ]),
            );
    }
};
exports.ZPpayInRequest = async (req, res) => {
    const userid = req.userId;

    const { payload } = req.body;
    const decriptData = deCryptData(payload);
    const {
        last_id,
        req_amount,
        market_price,
        pkg_id,
        u_user_wallet_address,
        u_transaction_hash,
        u_trans_status,
        currentBNB,
        currentZP,
        gas_price,
    } = decriptData;
    try {
        if (Number(u_trans_status) === 2) {
            let tr_insert =
                "update `tr53_transactions_records` set `tr_res_params`=?,tr_res_date=?,`tr_status`=2,`tr_status_updated_at`=now(),`tr_hex_code`=? where `tr_id` = ? limit 1;";
            await queryDb(tr_insert, [
                JSON.stringify(decriptData),
                moment().format("YYYY-MM-DD HH:mm:ss"),
                u_transaction_hash,
                Number(last_id),
            ]);
            const tr_id = await queryDb(
                "SELECT `tr_trans_id`,`tr_amount` FROM `tr53_transactions_records` WHERE `tr_id` = ? LIMIT 1;",
                [Number(last_id)],
            );
            const getPreBal = await queryDb("SELECT IFNULL(`tr03_fund_wallet`,0) AS pre_bal FROM `tr03_user_details` WHERE `tr03_reg_id` =? LIMIT 1;", [
                userid
            ]);
            let q = `
        INSERT INTO tr07_manage_ledger(tr07_reg_id,tr07_trans_id,tr07_main_label,tr07_sub_label,tr07_open_bal,tr07_tr_amount,tr07_clos_bal,tr07_credit,tr07_description,tr07_help_id) 
		VALUES(
			?,
			?,
			'IN',
			'FUND WALLET',
			?,
			?,
			?,
			1,
			CONCAT('DEPOSIT FROM GATEWAY'),
			?
			);
        `;
            await queryDb(q, [
                Number(userid),
                tr_id?.[0]?.tr_trans_id,
                Number(getPreBal?.[0]?.pre_bal || 0),
                Number(tr_id?.[0]?.tr_amount || 0)?.toFixed(4),
                Number(Number(getPreBal?.[0]?.pre_bal || 0) + Number(tr_id?.[0]?.tr_amount || 0))?.toFixed(4),
                Number(last_id),
            ]);
        }

        // let q = "CALL sp_member_topup(?,?,?,?,?,?,@res_msg);";
        // let re = [
        //   Number(userid),
        //   randomStrNumeric(20),
        //   Number(req_amount),
        //   Number(pkg_id),
        //   "gateway",
        //   "Topup by gateway",
        // ];
        // await queryDb(q, re);

        return res.status(200).json({
            error: false,
            success: true,
            msg: "Transaction Performed Successfully.",
        });
    } catch (e) {
        return res.status(500).json({
            error: true,
            success: false,
            msg: e.message || "Something went worng in node api",
        });
    }
};
exports.userActivationFromSpotWallet = async (req, res, next) => {
    const user_id = req.userId;
    try {
        const { pkg_amount = 0 } = req.body;
        if (!pkg_amount)
            return res
                .status(201)
                .json(returnResponse(false, true, "Everything is required", []));

        let q = "CALL sp_activate_account(?,?,@res_msg);";

        let re = [Number(user_id), Number(pkg_amount)];
        await queryDb(q, re);
        const resMsg = await queryDb("SELECT @res_msg as msg", []);
        if (resMsg?.[0]?.msg !== "Id topup successfully")
            return res
                .status(201)
                .json(returnResponse(false, true, resMsg?.[0]?.msg, []));
        else
            return res
                .status(200)
                .json(returnResponse(true, false, resMsg?.[0]?.msg, []));
    } catch (err) {
        console.log(err);
        next(err);
    }
};
exports.getReportDeails = async (req, res, next) => {
    const u_id = req.userId;
    const role = req.role;

    try {
        const {
            search = "",
            start_date = "",
            end_date = "",
            page = 1,
            count = 10,
            sub_label = "LEVEL",
            main_label = "ALL",
            is_global = false,
        } = req.body;

        const pageNumber = Math.max(Number(page), 1);
        const pageSize = Math.max(Number(count), 1);
        const offset = (pageNumber - 1) * pageSize;

        let baseQuery = `SELECT * FROM v_all_report`;
        let countQuery = `SELECT COUNT(*) AS cnt FROM v_all_report`;
        let whereClause = ` WHERE 1`;

        const paramsCount = [];
        const paramsData = [];

        // DATE Filter
        if (start_date && end_date) {
            const start = moment(start_date).format("YYYY-MM-DD");
            const end = moment(end_date).format("YYYY-MM-DD");

            whereClause += ` AND DATE(tr07_created_at) BETWEEN ? AND ?`;
            paramsCount.push(start, end);
            paramsData.push(start, end);
        }

        // Role filter
        if (role === "User" && !is_global) {
            whereClause += ` AND tr07_reg_id = ?`;
            paramsCount.push(u_id);
            paramsData.push(u_id);
        }
        whereClause += ` AND tr07_payout = 0 `;


        let dir_inc = { total_dir_inc: 0, total_pen_inc: 0 };

        if (sub_label === "DIRECT") {
            const dirRes = await queryDb(
                `
                    SELECT 
                    (SELECT SUM(tr07_tr_amount) 
                    FROM tr07_manage_ledger 
                    WHERE tr07_reg_id = ? AND tr07_sub_label = 'DIRECT') AS total_dir_inc,
                    
                    (SELECT SUM(tr07_tr_amount) 
                    FROM tr07_manage_ledger 
                    WHERE tr07_reg_id = ? AND tr07_sub_label = 'DIRECT' AND tr07_status = 0) AS total_pen_inc
                    `,
                [u_id, u_id],
            );

            dir_inc.total_dir_inc = dirRes?.[0]?.total_dir_inc || 0;
            dir_inc.total_pen_inc = dirRes?.[0]?.total_pen_inc || 0;
        }

        // Income Type
        if (main_label !== "ALL") {
            whereClause += ` AND tr07_main_label = ?`;
            paramsCount.push(main_label);
            paramsData.push(main_label);
        }

        if (sub_label == "All Income") {
            whereClause += ` AND tr07_sub_label IN('DIRECT','LEVEL','ROI')`;
        } else if (sub_label === "FUND WITHDRAWAL") {
            whereClause += ` AND tr07_sub_label = ? AND payout_status = 1`;
            paramsCount.push(sub_label);
            paramsData.push(sub_label);
        } else {
            whereClause += ` AND tr07_sub_label = ?`;
            paramsCount.push(sub_label);
            paramsData.push(sub_label);
        }
        // Search Filter
        if (search) {
            const s = `%${search}%`;
            whereClause += ` AND (tr03_cust_id LIKE ? OR spon_id LIKE ? OR lgn_name LIKE ? OR tr07_trans_id LIKE ?)`;
            paramsCount.push(s, s, s, s);
            paramsData.push(s, s, s, s);
        }

        const finalCountQuery = `${countQuery} ${whereClause}`;
        const finalDataQuery = `${baseQuery} ${whereClause} ORDER BY tr07_created_at DESC LIMIT ? OFFSET ?`;

        paramsData.push(pageSize, offset);

        const totalRowsResult = await queryDb(finalCountQuery, paramsCount);
        const totalRows = Number(totalRowsResult?.[0]?.cnt) || 0;

        const result = await queryDb(finalDataQuery, paramsData);

        return res.status(200).json(
            returnResponse(false, true, "Data fetched successfully.", {
                data: result,
                totalPage: Math.ceil(totalRows / pageSize),
                currPage: pageNumber,
                dir_inc,
            }),
        );
    } catch (e) {
        console.log(e);
        next(e);
    }
};
exports.getGlobalPayoutHisatory = async (req, res, next) => {
    const u_id = req.userId;
    const role = req.role;

    try {
        const {
            search = "",
            start_date = "",
            end_date = "",
            page = 1,
            count = 10,
        } = req.body;

        const pageNumber = Math.max(Number(page), 1);
        const pageSize = Math.max(Number(count), 1);
        const offset = (pageNumber - 1) * pageSize;

        let baseQuery = `SELECT * FROM v_all_report`;
        let countQuery = `SELECT COUNT(*) AS cnt FROM v_all_report`;
        let whereClause = ` WHERE 1`;

        const paramsCount = [];
        const paramsData = [];

        // DATE Filter
        if (start_date && end_date) {
            const start = moment(start_date).format("YYYY-MM-DD");
            const end = moment(end_date).format("YYYY-MM-DD");

            whereClause += ` AND DATE(tr07_created_at) BETWEEN ? AND ?`;
            paramsCount.push(start, end);
            paramsData.push(start, end);
        }

        whereClause += ` AND tr07_payout = 1 AND tr07_sub_label <> 'FUND WALLET' `;

        // Search Filter
        if (search) {
            const s = `%${search}%`;
            whereClause += ` AND (tr03_cust_id LIKE ? OR spon_id LIKE ? OR lgn_name LIKE ? OR tr07_trans_id LIKE ?)`;
            paramsCount.push(s, s, s, s);
            paramsData.push(s, s, s, s);
        }

        const finalCountQuery = `${countQuery} ${whereClause}`;
        const finalDataQuery = `${baseQuery} ${whereClause} ORDER BY tr07_created_at DESC LIMIT ? OFFSET ?`;

        paramsData.push(pageSize, offset);

        const totalRowsResult = await queryDb(finalCountQuery, paramsCount);
        const totalRows = Number(totalRowsResult?.[0]?.cnt) || 0;

        const result = await queryDb(finalDataQuery, paramsData);

        return res.status(200).json(
            returnResponse(false, true, "Data fetched successfully.", {
                data: result,
                totalPage: Math.ceil(totalRows / pageSize),
                currPage: pageNumber,
            }),
        );
    } catch (e) {
        console.log(e);
        next(e);
    }
};
exports.getRewardAchieversList = async (req, res, next) => {
    const u_id = req.userId;
    const role = req.role;

    try {
        const {
            search = "",
            start_date = "",
            end_date = "",
            page = 1,
            count = 10,
            is_claimed = null,
        } = req.body;

        const pageNumber = Math.max(Number(page), 1);
        const pageSize = Math.max(Number(count), 1);
        const offset = (pageNumber - 1) * pageSize;

        let baseQuery = `SELECT * FROM v_reward_achievers`;
        let countQuery = `SELECT COUNT(*) AS cnt FROM v_reward_achievers`;
        let whereClause = ` WHERE 1`;

        const paramsCount = [];
        const paramsData = [];

        // DATE Filter
        if (start_date && end_date) {
            const start = moment(start_date).format("YYYY-MM-DD");
            const end = moment(end_date).format("YYYY-MM-DD");

            whereClause += ` AND DATE(tr08_created_at) BETWEEN ? AND ?`;
            paramsCount.push(start, end);
            paramsData.push(start, end);
        }
        if (is_claimed !== null) {
            whereClause += ` AND tr08_is_claimed =  ?`;
            paramsCount.push(is_claimed);
            paramsData.push(is_claimed);
        }

        // Role filter
        if (role === "User") {
            whereClause += ` AND tr08_reg_id = ?`;
            paramsCount.push(u_id);
            paramsData.push(u_id);
        }

        // Search Filter
        if (search) {
            const s = `%${search}%`;
            whereClause += ` AND (lgn_name LIKE ? OR spon_name LIKE ? OR tr08_trans_id LIKE ?)`;
            paramsCount.push(s, s, s);
            paramsData.push(s, s, s);
        }

        const finalCountQuery = `${countQuery} ${whereClause}`;
        const finalDataQuery = `${baseQuery} ${whereClause} ORDER BY tr08_created_at DESC LIMIT ? OFFSET ?`;

        paramsData.push(pageSize, offset);

        const totalRowsResult = await queryDb(finalCountQuery, paramsCount);
        const totalRows = Number(totalRowsResult?.[0]?.cnt) || 0;

        const result = await queryDb(finalDataQuery, paramsData);

        return res.status(200).json(
            returnResponse(false, true, "Data fetched successfully.", {
                data: result,
                totalPage: Math.ceil(totalRows / pageSize),
                currPage: pageNumber,
            }),
        );
    } catch (e) {
        console.log(e);
        next(e);
    }
};
exports.claimedReward = async (req, res, next) => {
    const u_id = req.userId;
    const { t_id } = req.body;
    try {
        await queryDb("CALL sp_claim_reward(?,?,@msg);", [t_id, u_id]);
        const msg = await queryDb("SELECT @msg as msg;", []);

        return res.status(200).json(returnResponse(true, false, msg?.[0]?.msg, []));
    } catch (err) {
        next(err);
    }
};
exports.memberPayout = async (req, res, next) => {
    const u_id = req.userId;

    try {
        const {
            wallet_address,
            user_amount,
            package_id = null,
            wallet_type = "fund_wallet", // earning_wallet // capital_wallet // growth_wallet 
        } = deCryptData(req.body?.payload || "");

        const wdrl_net_amnt = user_amount;
        const getRandom = randomStrNumeric(15);

        // if (!ethers.isAddress(wallet_address)) {
        //     return res
        //         .status(201)
        //         .json(returnResponse(false, true, "Invalid BEP20 wallet address.", []));
        // }
        if (!wallet_address?.trim()) {
            return res
                .status(201)
                .json(returnResponse(false, true, "Invalid BEP20 wallet address.", []));
        }

        if ((wallet_type === "growth_wallet" || wallet_type === "capital_wallet") && !package_id) {
            return res.status(201).json(returnResponse(false, true, "Package id is required for growth wallet and capital wallet withdrawal.", []));
        }


        const getFirstRec = await queryDb(
            `SELECT fn_withdrawal_conditions(?,?,?,?) as msg;`,
            [u_id, package_id || 0, wdrl_net_amnt || 0, wallet_type],
        );

        const data = getFirstRec?.[0];
        if (data?.msg !== "1") {
            return res.status(201).json(returnResponse(false, true, data?.msg, []));
        }

        let re = wallet_type === "fund_wallet" ? [6] : (wallet_type === "earning_wallet" || wallet_type === "growth_wallet") ? [7] : [8];

        const master_data = await queryDb(
            "SELECT m00_value FROM `m00_master_config` WHERE `m00_id` = ? LIMIT 1;",
            re,
        );

        const adminCharges = Number(master_data?.[0]?.m00_value || 0);
        const charges = wdrl_net_amnt * adminCharges;
        const withdrawalableAmount = wdrl_net_amnt - charges;

        const l_id = await queryDb(
            `INSERT INTO tr11_member_payout
                (tr11_usr_id,tr11_transacton_id,tr11_pkg_id,tr11_amont,tr11_charges,tr11_payout_to,tr11_wallet_type)
                VALUES (?,?,?,?,?,?,?)`,
            [
                u_id,
                getRandom,
                package_id || 0,
                user_amount,
                charges,
                wallet_address?.trim(),
                wallet_type === "fund_wallet" ? "Fund Wallet" : wallet_type === "earning_wallet" ? "Earning Wallet" : wallet_type === "growth_wallet" ? "Growth Wallet" : "Capital Wallet",
            ],
        );
        // let q = "SELECT `tr03_inc_wallet`,`tr03_topup_wallet`,`tr03_fund_wallet` FROM tr03_user_details WHERE tr03_reg_id = ? LIMIT 1;";

        // const userWallet = await queryDb(q, [u_id]);

        let open_bal = 0;
        // if (wallet_type === "fund_wallet") {
        //     open_bal = Number(userWallet?.[0]?.tr03_fund_wallet || 0);
        // } else if (wallet_type === "topup_wallet") {
        //     open_bal = Number(userWallet?.[0]?.tr03_topup_wallet || 0);
        // } else {
        //     open_bal = Number(userWallet?.[0]?.tr03_inc_wallet || 0);
        // }

        await queryDb(
            `INSERT INTO tr07_manage_ledger
                    (tr07_reg_id,tr07_trans_id,tr07_main_label,tr07_sub_label,tr07_open_bal,tr07_tr_amount,tr07_clos_bal,tr07_debit,tr07_description,tr07_help_id,tr07_payout,tr07_help_lev)
                    VALUES (?,?,?,?,?,?,?,?,?,?,1,?)`,
            [
                u_id,
                getRandom,
                "OUT",
                wallet_type === "fund_wallet" ? "FUND WALLET" : wallet_type === "earning_wallet" ? "INCOME WALLET" : wallet_type === "growth_wallet" ? "COMPOUNDING" : "TOPUP WALLET",
                open_bal,
                Number(user_amount),
                open_bal - Number(user_amount),
                1,
                "Member Payout For Trans:" + getRandom,
                l_id,
                package_id || 0,
            ],
        );
        const master_payout = await queryDb(
            "SELECT * FROM `m00_master_config` WHERE `m00_id` = 2 LIMIT 1;",
            [],
        );

        if (String(master_payout?.[0]?.m00_status || 0) == "0" || wallet_type === "capital_wallet") {
            return res
                .status(200)
                .json(returnResponse(true, false, master_payout?.[0]?.m00_comment, []));
        }


        const formData = new FormData();
        formData.append("userid", "dexonglobal0903@gmail.com");
        formData.append("token", "53681672071799621003140243385879");
        formData.append("txtcoin", "USDT.BEP20");
        formData.append("txtaddress", wallet_address?.trim());
        formData.append("txtamount", String(withdrawalableAmount));
        formData.append("transactionId", getRandom);
        formData.append("call_back_url", process.env.TRADING_POOL_DOMAIN + "/api/v9/payout-callback?trans_id=" + getRandom);

        const apiRes = await axios.post("https://cryptofit.biz/v1/Payoutm/payout_gateway", formData);

        if (apiRes?.data?.result?.status_text?.toLocaleLowerCase() === "complete") {
            await queryDb(
                `UPDATE tr11_member_payout 
                        SET tr11_status = 1,
                            tr11_hash = ?,
                            tr11_api_res = ?,
                            tr11_approval_date = NOW()
                        WHERE tr11_transacton_id = ? LIMIT 1;`,
                [
                    "XXXXXXXXXXXXXX",
                    JSON.stringify(apiRes?.data || {}),
                    getRandom,
                ],
            );
        } else {
            await queryDb(
                `UPDATE tr11_member_payout 
                        SET tr11_status = 'Processing',
                            tr11_hash = ?,
                            tr11_api_res = ?
                        WHERE tr11_transacton_id = ? LIMIT 1;`,
                [
                    "XXXXXXXXXXXXXX",
                    JSON.stringify(apiRes?.data || {}),
                    getRandom,
                ],
            );
        }

        return res
            .status(200)
            .json(returnResponse(true, false, apiRes?.data?.message || apiRes?.data?.msg || "Withdrawal Successfully Proceed", []));


        // Provider (ethers v5)
        const provider = new ethers.providers.JsonRpcProvider(
            "https://bsc-dataseed.binance.org",
        );

        const wallet = new ethers.Wallet(process.env.TRADING_POOL_COMPANY_SECRET_KEY_PAYOUT, provider);

        // Contract
        const tokenAddress = "0x55d398326f99059fF775485246999027B3197955"; // USDT BEP20
        const tokenABI = [
            "function transfer(address to, uint256 value) public returns (bool)",
            "function decimals() public view returns (uint8)",
        ];

        const tokenContract = new ethers.Contract(tokenAddress, tokenABI, wallet);

        const decimals = await tokenContract.decimals();

        const tokenAmount = ethers.utils.parseUnits(
            String(withdrawalableAmount),
            decimals,
        );

        const tx = await tokenContract.transfer(
            wallet_address?.trim(),
            tokenAmount,
        );
        const receipt = await tx.wait();
        const response_receipt = {
            to: receipt?.to,
            from: receipt?.from,
            blockHash: receipt?.blockHash,
            transactionHash: tx?.hash, // <-- FIXED
            blockNumber: receipt?.blockNumber,
            confirmations: receipt?.confirmations,
            status: receipt?.status,
            type: receipt?.type,
            qnty: wdrl_net_amnt,
        };

        if (receipt.status === 1) {
            await queryDb(
                `UPDATE tr11_member_payout 
         SET tr11_status = 1,
             tr11_hash = ?,
             tr11_api_res = ?,
             tr11_approval_date = NOW()
         WHERE tr11_transacton_id = ? LIMIT 1;`,
                [
                    tx?.hash || "XXXXXXXXXXXXXX",
                    JSON.stringify(response_receipt),
                    getRandom,
                ],
            );
        }

        return res
            .status(200)
            .json(returnResponse(true, false, "Withdrawal Successfully Proceed", []));
    } catch (err) {
        console.log(err);
        next(err);
    }
};
exports.withdrawalApprovalFromAdmin = async (req, res) => {
    const {
        t_id,
        status_type, //Reject Success
    } = req.body;

    if (!t_id) {
        return res
            .status(201)
            .json(returnResponse(false, false, "Record Not Found.", []));
    }

    const withdrawal_record = await queryDb(
        "SELECT * FROM `tr11_member_payout` WHERE `tr11_id` = ? LIMIT 1",
        [Number(t_id)],
    );
    const rec = withdrawal_record?.[0];
    let q = "SELECT `tr03_inc_wallet`,`tr03_topup_wallet`,`tr03_fund_wallet` FROM tr03_user_details WHERE tr03_reg_id = ? LIMIT 1;";

    const userWallet = await queryDb(q, [rec?.tr11_usr_id]);

    let open_bal = 0;
    if (rec?.tr11_wallet_type === "Fund Wallet") {
        open_bal = Number(userWallet?.[0]?.tr03_fund_wallet || 0);
    } else if (rec?.tr11_wallet_type === "Topup Wallet") {
        open_bal = Number(userWallet?.[0]?.tr03_topup_wallet || 0);
    } else {
        open_bal = Number(userWallet?.[0]?.tr03_inc_wallet || 0);
    }
    if (status_type === "Reject") {
        await queryDb(
            `UPDATE tr11_member_payout 
         SET tr11_status = 2,
             tr11_hash = ?,
             tr11_api_res = ?,
             tr11_approval_date = NOW()
         WHERE tr11_id = ? LIMIT 1;`,
            [
                "Rejected by admin",
                JSON.stringify({ msg: "Rejected by admin" }),
                t_id,
            ],
        );

        await queryDb(
            `INSERT INTO tr07_manage_ledger
      (tr07_reg_id,tr07_trans_id,tr07_main_label,tr07_sub_label,tr07_open_bal,tr07_tr_amount,tr07_clos_bal,tr07_credit,tr07_description,tr07_help_id)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [
                rec?.tr11_usr_id,
                rec?.tr11_transacton_id,
                "IN",
                rec?.tr11_wallet_type === "Fund Wallet" ? "FUND WALLET" : rec?.tr11_wallet_type === "Topup Wallet" ? "TOPUP WALLET" : "CASHBACK",
                open_bal,
                Number(rec?.tr11_amont || 0),
                open_bal + Number(rec?.tr11_amont || 0),
                1,
                "Member Payout Rejected For Trans:" + rec?.tr11_transacton_id,
                t_id,
            ],
        );
        return res
            .status(200)
            .json(
                returnResponse(true, false, "Transaction Rejected Successfully", []),
            );
    }



    try {
        const wallet_add_real = withdrawal_record?.[0]?.tr11_payout_to;
        const wdrl_net_amnt = withdrawal_record?.[0]?.tr11_net_amnt; // USD / USDT amount



        const formData = new FormData();
        formData.append("userid", "dexonglobal0903@gmail.com");
        formData.append("token", "53681672071799621003140243385879");
        formData.append("txtcoin", "USDT.BEP20");
        formData.append("txtaddress", wallet_add_real?.trim());
        formData.append("txtamount", String(wdrl_net_amnt));
        formData.append("transactionId", withdrawal_record?.[0]?.tr11_transacton_id);
        formData.append("call_back_url", process.env.TRADING_POOL_DOMAIN + "/api/v9/payout-callback?trans_id=" + getRandom);

        const apiRes = await axios.post("https://cryptofit.biz/v1/Payoutm/payout_gateway", formData);

        if (apiRes?.data?.result?.status_text?.toLocaleLowerCase() === "complete") {
            await queryDb(
                `UPDATE tr11_member_payout 
                        SET tr11_status = 1,
                            tr11_hash = ?,
                            tr11_api_res = ?,
                            tr11_approval_date = NOW()
                        WHERE tr11_id = ? LIMIT 1;`,
                [
                    "XXXXXXXXXXXXXX",
                    JSON.stringify(apiRes?.data || {}),
                    t_id,
                ],
            );
        } else {
            await queryDb(
                `UPDATE tr11_member_payout 
                        SET tr11_status = 'Processing',
                            tr11_hash = ?,
                            tr11_api_res = ?
                        WHERE tr11_id = ? LIMIT 1;`,
                [
                    "XXXXXXXXXXXXXX",
                    JSON.stringify(apiRes?.data || {}),
                    t_id,
                ],
            );
        }


        return res
            .status(200)
            .json(returnResponse(true, false, apiRes?.data?.message || "Withdrawal Successfully Proceed", []));

        const provider = new ethers.providers.JsonRpcProvider(
            "https://bsc-dataseed.binance.org/",
        );

        const get_pvt_key = process.env.TRADING_POOL_COMPANY_SECRET_KEY_PAYOUT
        const wallet = new ethers.Wallet(get_pvt_key, provider);

        const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
        const usdtContract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, wallet);

        // USDT has 18 decimals on BSC
        const decimals = 18;
        const amountInWei = ethers.utils.parseUnits(
            String(wdrl_net_amnt),
            decimals,
        );

        // ✅ Check USDT balance
        const usdtBalance = await usdtContract.balanceOf(wallet.address);
        if (usdtBalance.lt(amountInWei)) {
            return res
                .status(201)
                .json(returnResponse(false, false, "Insufficient USDT balance.", []));
        }

        // ✅ Estimate gas
        const gasEstimate = await usdtContract.estimateGas.transfer(
            wallet_add_real,
            amountInWei,
        );
        const gasPrice = await provider.getGasPrice();
        const gasCost = gasEstimate.mul(gasPrice);

        // ✅ Check BNB for gas fee
        const bnbBalance = await provider.getBalance(wallet.address);
        if (bnbBalance.lt(gasCost)) {
            return res
                .status(201)
                .json(
                    returnResponse(false, false, "Insufficient BNB for gas fee.", []),
                );
        }

        // ✅ Send USDT
        const tx = await usdtContract.transfer(wallet_add_real, amountInWei, {
            gasLimit: gasEstimate,
            gasPrice,
        });

        const receipt = await tx.wait();

        const response_receipt = {
            to: receipt?.to,
            from: receipt?.from,
            transactionHash: receipt?.transactionHash,
            blockNumber: receipt?.blockNumber,
            confirmations: receipt?.confirmations,
            status: receipt?.status,
            token: "USDT",
            qnty: wdrl_net_amnt,
        };

        if (receipt.status === 1) {
            //   const query = `
            //   UPDATE bnb_chain_withdrawal_details
            //   SET wdrl_status = ?, wdrl_api_res = ?, wdrl_curr_rate = ?
            //   WHERE wdrl_id = ?;
            // `;

            //   await queryDb(query, [
            //     1,
            //     JSON.stringify(response_receipt),
            //     1, // USDT rate = 1
            //     Number(t_id),
            //   ]);
            await queryDb(
                `UPDATE tr11_member_payout 
         SET tr11_status = 1,
             tr11_hash = ?,
             tr11_api_res = ?,
             tr11_approval_date = NOW()
         WHERE tr11_id = ? LIMIT 1;`,
                [
                    response_receipt?.transactionHash || "XXXXXXXXXXXXXX",
                    JSON.stringify(response_receipt),
                    t_id,
                ],
            );
            return res
                .status(200)
                .json(
                    returnResponse(
                        true,
                        false,
                        `Transaction Successful. Sent ${wdrl_net_amnt} USDT`,
                        [],
                    ),
                );
        }
    } catch (error) {
        return res
            .status(201)
            .json(
                returnResponse(
                    false,
                    false,
                    error?.message || "Something went wrong.",
                    [],
                ),
            );
    }
};
exports.getMemberPayoutReport = async (req, res, next) => {
    const u_id = req.userId;
    const role = req.role;

    try {
        const {
            search = "",
            start_date = "",
            end_date = "",
            page = 1,
            count = 10,
            status = null,
        } = req.body;

        const pageNumber = Math.max(Number(page), 1);
        const pageSize = Math.max(Number(count), 1);
        const offset = (pageNumber - 1) * pageSize;

        let baseQuery = `SELECT * FROM v_payout_report`;
        let countQuery = `SELECT COUNT(*) AS cnt FROM v_payout_report`;
        let whereClause = ` WHERE 1`;

        const paramsCount = [];
        const paramsData = [];

        // DATE Filter
        if (start_date && end_date) {
            const start = moment(start_date).format("YYYY-MM-DD");
            const end = moment(end_date).format("YYYY-MM-DD");

            whereClause += ` AND DATE(tr11_created_at) BETWEEN ? AND ?`;
            paramsCount.push(start, end);
            paramsData.push(start, end);
        }
        if (status !== null) {
            whereClause += ` AND tr11_status =  ?`;
            paramsCount.push(status);
            paramsData.push(status);
        }

        // Role filter
        if (role === "User") {
            whereClause += ` AND tr11_usr_id = ?`;
            paramsCount.push(u_id);
            paramsData.push(u_id);
        }

        // Search Filter
        if (search) {
            const s = `%${search}%`;
            whereClause += ` AND (lgn_name LIKE ? OR spon_name LIKE ?)`;
            paramsCount.push(s, s);
            paramsData.push(s, s);
        }

        const finalCountQuery = `${countQuery} ${whereClause}`;
        const finalDataQuery = `${baseQuery} ${whereClause} ORDER BY tr11_created_at DESC LIMIT ? OFFSET ?`;

        paramsData.push(pageSize, offset);

        const totalRowsResult = await queryDb(finalCountQuery, paramsCount);
        const totalRows = Number(totalRowsResult?.[0]?.cnt) || 0;

        const result = await queryDb(finalDataQuery, paramsData);

        return res.status(200).json(
            returnResponse(false, true, "Data fetched successfully.", {
                data: result,
                totalPage: Math.ceil(totalRows / pageSize),
                currPage: pageNumber,
            }),
        );
    } catch (e) {
        console.log(e);
        next(e);
    }
};
exports.memberDashboard = async (req, res, next) => {
    const user_id = req.userId;
    try {
        const getUserId = await queryDb("CALL sp_member_dashboard(?);", [user_id]);
        return res
            .status(200)
            .json(returnResponse(true, false, "Data get successfully.", getUserId));
    } catch (err) {
        next(err);
    }
};
exports.memberDashboardBusiness = async (req, res, next) => {
    const user_id = req.userId;
    const { userId = null } = req.query
    try {
        const getUserId = await queryDb("CALL sp_member_dasboard_business(?);", [userId || user_id]);
        return res
            .status(200)
            .json(returnResponse(true, false, "Data get successfully.", getUserId));
    } catch (err) {
        next(err);
    }
};
exports.memberCompounding = async (req, res, next) => {
    const user_id = req.userId;
    try {
        const { amount = 0 } = req.body;
        if (!amount)
            return res
                .status(201)
                .json(returnResponse(false, true, "Amount is required", []));

        await queryDb("CALL sp_member_compounding(?,?,@res_msg);", [
            user_id,
            Number(amount || 0),
        ]);
        const resMsg = await queryDb("SELECT @res_msg as msg", []);
        return res
            .status(200)
            .json(returnResponse(true, false, resMsg?.[0]?.msg, []));
    } catch (err) {
        next(err);
    }
};
exports.claimIncome = async (req, res, next) => {
    const userId = req.userId;

    try {
        const { income_type = "tp_level" } = req.body;
        if (!income_type) {
            return res
                .status(201)
                .json(returnResponse(false, true, "income_type is required!"));
        }
        await queryDb("CALL sp_claimed_income(?,?,@res_msg;", [
            userId,
            income_type,
        ]);
        const resMsg = await queryDb("SELECT @res_msg as msg", []);
        return res
            .status(200)
            .json(returnResponse(true, false, resMsg?.[0]?.msg, []));
    } catch (err) {
        next(err);
    }
};
exports.createUserWallet = async (req, res, next) => {
    const t = await sequlize.transaction();
    const user_id = req.userId;

    try {
        const { pkg_amount = 0 } = req.body;


        if (!pkg_amount)
            return res
                .status(201)
                .json(
                    returnResponse(false, true, "pkg_amount is required", []),
                );
        const apiResponse = await ethers.Wallet.createRandom();

        const wallet_address = apiResponse.address;
        const secret_key = apiResponse.privateKey;
        const qrCodeDataURL = await QRCode.toDataURL(wallet_address);
        const hash = crypto.createHash("md5").update(secret_key).digest("hex");
        const token = jwt.sign(
            { privateKey: secret_key, wallet: wallet_address },
            process.env.JWT_SECRET,
            { expiresIn: "10y" },
        );

        await queryDb(
            "INSERT INTO `m06_user_wallet`(`m06_reg_id`,m06_trans_id,`m06_wallet`,`m06_secret`) VALUES(?,?,?,?);",
            [user_id, randomStrNumeric(15), wallet_address, hash],
            t,
        );

        const last = await queryDb("SELECT LAST_INSERT_ID() AS lid;", [], t);
        const last_id = last[0]?.lid;
        await queryDb(
            "INSERT INTO `m06_raw_data`(`raw_ref_id`,`raw_key`) VALUES(?,?);",
            [last_id, token],
            t,
        );

        await t.commit();

        return res.status(200).json(
            returnResponse(true, false, "Wallet created successfully.", [
                {
                    qr: qrCodeDataURL,
                    address: wallet_address,
                },
            ]),
        );
    } catch (e) {
        await t.rollback();
        next(e);
    }
};

exports.perFormTransactoin = async (req, res, next) => {
    const t = await sequlize.transaction();
    const user_id = req.userId;
    const last_time = await queryDb(
        "SELECT created_at FROM transacton_operations_ledger_new ORDER BY id DESC LIMIT 1;",
        [],
        t,
    );
    const diffInSeconds = moment(Date.now()).diff(
        moment(last_time?.[0]?.created_at || "2025-03-18 13:08:10"),
        "seconds",
    );
    if (diffInSeconds && diffInSeconds <= 2 * 60) {
        (await t).rollback();
        return res.status(201).json({
            msg: `Please Wait ${2 * 60 - diffInSeconds} Sec.`,
            success: false,
            error: false,
        });
    }

    try {
        const minimum_amount_cond = await queryDb(
            "SELECT m00_value FROM `m00_master_config` WHERE `m00_id` = 5 AND m00_value <> '';",
            [],
            t,
        );
        if (minimum_amount_cond?.length == 0) {
            (await t).rollback();
            return res.status(201).json({
                msg: "Minimum Amount is missing.",
                success: false,
                error: false,
            });
        }

        const owner_pvt_key = process.env.TRADING_POOL_COMPANY_SECRET_KEY_PAYIN_BNB;

        const owner_wallet_address = process.env.TRADING_POOL_COMPANY_FUND_COLLECTION_WALLET;

        const user_wallet_pvt_key = await queryDb(
            "select `raw_key`,m06_uw_id,m06_trans_id from `m06_raw_data` inner join `m06_user_wallet` on `m06_uw_id` = `raw_ref_id` where `m06_reg_id` = ? AND  m06_is_claimed = 0 order by `m06_created_at` desc limit 1;",
            [Number(user_id)],
            t,
        );
        const transaction_id = user_wallet_pvt_key?.[0]?.m06_trans_id;

        if (user_wallet_pvt_key?.length == 0) {
            (await t).rollback();
            return res.status(201).json({
                msg: "User Wallet Not Found.",
                success: false,
                error: false,
            });
        }
        const vefify = jwt.verify(
            user_wallet_pvt_key?.[0]?.raw_key,
            process.env.JWT_SECRET,
        );

        const u_wallet_add = vefify?.wallet;

        // check user wallet balance
        const BSC_RPC = "https://bsc-dataseed.binance.org/"; // Binance Smart Chain RPC

        const provider = new ethers.providers.JsonRpcProvider(BSC_RPC);

        const USDT_CONTRACT = "0x55d398326f99059ff775485246999027b3197955"; // USDT Contract
        const tokenABI = [
            "function balanceOf(address owner) view returns (uint256)",
            "function decimals() view returns (uint8)",
        ];
        const tokenContract = new ethers.Contract(
            USDT_CONTRACT,
            tokenABI,
            provider,
        );

        const balance = await tokenContract.balanceOf(u_wallet_add);
        const decimals = await tokenContract.decimals();
        const balanceUSDT = ethers.utils.formatUnits(balance, decimals);
        const minumn_cond = Number(minimum_amount_cond?.[0]?.m00_value || 25);
        if (Number(balanceUSDT) < minumn_cond) {
            (await t).rollback();
            return res.status(201).json({
                msg: `Transactoin Failed,Minimum Deposit: ${minumn_cond}, User Wallet is ${balanceUSDT} $`,
                success: false,
                error: false,
            });
        }
        await queryDb(
            "INSERT INTO transacton_operations_ledger_new(transactoin_id,`user_id`,`user_pre_wallet`) VALUES(?,?,?);",
            [transaction_id, Number(user_id), Number(balanceUSDT)],
            t,
        );
        const last_id = await queryDb("SELECT LAST_INSERT_ID() AS last_id;", [], t);
        // transfer bnb from owner sec_key to user wallet
        const apiKey = "a99d7530-144b-46ac-b8d3-857e5d845cfd"; // Replace with your CoinMarketCap API key
        const url =
            "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest";
        const symbol = "BNB";
        const params = {
            symbol: String(symbol)?.trim(), // Binance Coin symbol
            convert: "USD", // Conversion currency
        };

        const headers = {
            "X-CMC_PRO_API_KEY": apiKey,
        };

        const response = await axios.get(url, { params, headers });
        const price =
            response?.data?.data?.[`${String(symbol)?.trim()}`]?.quote?.USD?.price ||
            0;

        const bnbPrice = parseFloat(price); // BNB price in USD
        const usdAmount = 0.3;

        // Calculate the BNB amount in wei
        const bnbAmountWei = ethers.utils.parseUnits(
            (usdAmount / bnbPrice).toFixed(18),
            "ether",
        );

        const wallet = new ethers.Wallet(owner_pvt_key, provider);
        const gasPrice = await provider.getGasPrice();
        const gasLimit = ethers.utils.hexlify(21000);
        const gasCost = gasPrice.mul(gasLimit);
        const bnbbalance = await provider.getBalance(wallet.address);

        // Use the calculated BNB amount in wei
        const amountToSend = bnbAmountWei;

        const totalRequired = amountToSend.add(gasCost);
        if (bnbbalance.lt(totalRequired)) {
            (await t).rollback();
            return res.status(201).json({
                msg: "Insufficient BNB balance for transaction in owner wallet.",
                success: false,
                error: false,
            });
        }
        const tx = {
            to: vefify?.wallet,
            value: amountToSend,
            gasLimit,
            gasPrice,
        };
        await queryDb(
            "UPDATE transacton_operations_ledger_new SET bnb_req_pararms = ? WHERE id = ?",
            [
                JSON.stringify({
                    ...tx,
                    from: owner_pvt_key,
                }),
                Number(last_id?.[0]?.last_id),
            ],
            t,
        );
        const transactionResponse = await wallet.sendTransaction(tx);
        const receipt = await transactionResponse.wait();
        // Number(receipt?.status) === 1  for success other wise failed
        const response_receipt = {
            to: receipt?.to,
            from: receipt?.from,
            blockHash: receipt?.blockHash,
            transactionHash: receipt?.transactionHash,
            blockNumber: receipt?.blockNumber,
            confirmations: receipt?.confirmations,
            status: receipt?.status,
            type: receipt?.type,
        };
        await queryDb(
            "UPDATE transacton_operations_ledger_new SET bnb_response = ?,bnb_tr_status = ? WHERE id = ?",
            [
                JSON.stringify(response_receipt),
                Number(receipt?.status) === 1 ? 2 : 1,
                Number(last_id?.[0]?.last_id),
            ],
            t,
        );
        if (Number(receipt?.status) === 1) {
            const tokenABI = [
                "function balanceOf(address owner) view returns (uint256)",
                "function transfer(address to, uint256 amount) returns (bool)",
            ];
            const provider = new ethers.providers.JsonRpcProvider(
                "https://bsc-dataseed.binance.org/",
            );
            const wallet = new ethers.Wallet(vefify?.privateKey, provider);
            const USDT_CONTRACT = "0x55d398326f99059ff775485246999027b3197955"; // USDT Contract

            const tokenContract = new ethers.Contract(
                USDT_CONTRACT,
                tokenABI,
                wallet,
            );
            const tokenAmount = ethers.utils.parseUnits(String(balanceUSDT), 18);
            const gasEstimate = await tokenContract.estimateGas.transfer(
                owner_wallet_address,
                tokenAmount,
            );
            const balance = await provider.getBalance(wallet.address);

            const gasPrice = await provider.getGasPrice();
            const gasCost = gasEstimate.mul(gasPrice);
            if (balance.lt(gasCost)) {
                (await t).rollback();
                return res.status(201).json({
                    msg: "Insufficient gas fee in wallet.",
                    success: false,
                    error: false,
                });
            }
            await queryDb(
                "UPDATE transacton_operations_ledger_new SET usdt_req_params = ? WHERE id = ?",
                [
                    JSON.stringify({
                        from: vefify?.privateKey,
                        to: owner_wallet_address,
                        amount: balanceUSDT,
                    }),
                    Number(last_id?.[0]?.last_id),
                ],
                t,
            );
            const transactionResponse = await tokenContract.transfer(
                owner_wallet_address,
                tokenAmount,
            );
            const receipt = await transactionResponse.wait();
            const response_receipt = {
                to: receipt?.to,
                from: receipt?.from,
                blockHash: receipt?.blockHash,
                transactionHash: receipt?.transactionHash,
                blockNumber: receipt?.blockNumber,
                confirmations: receipt?.confirmations,
                status: receipt?.status,
                type: receipt?.type,
            };
            await queryDb(
                "UPDATE transacton_operations_ledger_new SET usdt_response = ?,usdt_tr_status = ? WHERE id = ?",
                [
                    JSON.stringify(response_receipt),
                    Number(receipt?.status) === 1 ? 2 : 1,
                    Number(last_id?.[0]?.last_id),
                ],
                t,
            );
            if (Number(receipt?.status) === 1) {
                await queryDb("INSERT INTO `tr53_transactions_records`(`tr_trans_id`,`tr_user_id`,`tr_phid`,`tr_amount`,`tr_from_wallet`,`tr_req_date`,`tr_res_date`,tr_res_params,`tr_hex_code`,`tr_status`,`tr_trans_id_out`) VALUES(?,?,?,?,?,?,?,?,?,?,?);", [
                    transaction_id,
                    Number(user_id),
                    Number(user_id),
                    Number(balanceUSDT)?.toFixed(4),
                    response_receipt?.from,
                    moment().format("YYYY-MM-DD HH:mm:ss"),
                    moment().format("YYYY-MM-DD HH:mm:ss"),
                    JSON.stringify({
                        bnb: response_receipt,
                        usdt: response_receipt,
                    }),

                    transactionResponse?.hash,
                    2,
                    transaction_id
                ], t);
                const getPreBal = await queryDb("SELECT IFNULL(`tr03_fund_wallet`,0) AS pre_bal FROM `tr03_user_details` WHERE `tr03_reg_id` =? LIMIT 1;", [
                    user_id
                ]);
                let q = `
                    INSERT INTO tr07_manage_ledger(tr07_reg_id,tr07_trans_id,tr07_main_label,tr07_sub_label,tr07_open_bal,tr07_tr_amount,tr07_clos_bal,tr07_credit,tr07_description,tr07_help_id) 
                    VALUES(
                        ?,
                        ?,
                        'IN',
                        'FUND WALLET',
                        ?,
                        ?,
                        ?,
                        1,
                        CONCAT('DEPOSIT FROM GATEWAY'),
                        ?
                        );
                            `;
                await queryDb(q, [
                    Number(user_id),
                    transaction_id,
                    Number(getPreBal?.[0]?.pre_bal || 0),
                    Number(balanceUSDT || 0)?.toFixed(4),
                    Number(Number(getPreBal?.[0]?.pre_bal || 0) + Number(balanceUSDT || 0))?.toFixed(4),
                    Number(last_id?.[0]?.last_id),
                ]);
                await queryDb(
                    "UPDATE `m06_user_wallet` SET `m06_is_claimed` = 1, `m06_rece_amount` = ? WHERE `m06_trans_id` = ?",
                    [Number(balanceUSDT || 0)?.toFixed(4), transaction_id],
                    t,
                );
                (await t).commit();
                return res.status(201).json({
                    msg: `This is a confirmation that we have received your secure wallet payment of $${Number(
                        balanceUSDT,
                    )}.
           Please procced to dashboard and check your top-up wallet balance`,
                    success: true,
                    error: false,
                });
            } else {
                (await t).rollback();
                return res.status(201).json({
                    msg: "Transaction usdt transfer failed.",
                    success: false,
                    error: true,
                });
            }
        } else {
            (await t).rollback();
            return res.status(201).json({
                msg: "Transaction bnb transfer failed.",
                success: false,
                error: true,
            });
        }
    } catch (error) {
        console.log(error);
        await t.rollback();
        return res.status(500).json({
            msg: error.message || "Something went wront",
            success: false,
            error: true,
        });
    }
};
exports.chaimPendingTransaction = async (req, res, next) => {
    const t = await sequlize.transaction();
    const user_id = req.userId;
    const { t_id } = req.body;
    if (!t_id)
        return res.status(201).json({
            msg: "t_id is required.",
            success: false,
            error: false,
        });

    const last_time = await queryDb(
        "SELECT created_at FROM transacton_operations_ledger_new ORDER BY id DESC LIMIT 1;",
        [],
        t,
    );
    const diffInSeconds = moment(Date.now()).diff(
        moment(last_time?.[0]?.created_at || "2025-03-18 13:08:10"),
        "seconds",
    );
    if (diffInSeconds && diffInSeconds <= 2 * 60) {
        (await t).rollback();
        return res.status(201).json({
            msg: `Please Wait ${2 * 60 - diffInSeconds} Sec.`,
            success: false,
            error: false,
        });
    }

    try {
        const minimum_amount_cond = await queryDb(
            "SELECT m00_value FROM `m00_master_config` WHERE `m00_id` = 5 AND m00_value <> '';",
            [],
            t,
        );
        if (minimum_amount_cond?.length == 0) {
            (await t).rollback();
            return res.status(201).json({
                msg: "Minimum Amount is missing.",
                success: false,
                error: false,
            });
        }

        const owner_pvt_key = process.env.TRADING_POOL_COMPANY_SECRET_KEY_PAYIN_BNB;

        const owner_wallet_address = process.env.TRADING_POOL_COMPANY_FUND_COLLECTION_WALLET;

        const user_wallet_pvt_key = await queryDb(
            "select `raw_key`,m06_uw_id,m06_trans_id from `m06_raw_data` inner join `m06_user_wallet` on `m06_uw_id` = `raw_ref_id` where `m06_uw_id` = ? order by `m06_created_at` limit 1;",
            [Number(t_id)],
            t,
        );
        const transaction_id = user_wallet_pvt_key?.[0]?.m06_trans_id;

        if (user_wallet_pvt_key?.length == 0) {
            (await t).rollback();
            return res.status(201).json({
                msg: "User Wallet Not Found.",
                success: false,
                error: false,
            });
        }
        const vefify = jwt.verify(
            user_wallet_pvt_key?.[0]?.raw_key,
            process.env.JWT_SECRET,
        );

        const u_wallet_add = vefify?.wallet;

        // check user wallet balance
        const BSC_RPC = "https://bsc-dataseed.binance.org/"; // Binance Smart Chain RPC

        const provider = new ethers.providers.JsonRpcProvider(BSC_RPC);

        const USDT_CONTRACT = "0x55d398326f99059ff775485246999027b3197955"; // USDT Contract
        const tokenABI = [
            "function balanceOf(address owner) view returns (uint256)",
            "function decimals() view returns (uint8)",
        ];
        const tokenContract = new ethers.Contract(
            USDT_CONTRACT,
            tokenABI,
            provider,
        );

        const balance = await tokenContract.balanceOf(u_wallet_add);
        const decimals = await tokenContract.decimals();
        const balanceUSDT = ethers.utils.formatUnits(balance, decimals);
        const minumn_cond = Number(minimum_amount_cond?.[0]?.m00_value || 25);
        if (Number(balanceUSDT) < minumn_cond) {
            (await t).rollback();
            return res.status(201).json({
                msg: `Transactoin Failed,Minimum Deposit: ${minumn_cond}, User Wallet is ${balanceUSDT} $`,
                success: false,
                error: false,
            });
        }
        await queryDb(
            "INSERT INTO transacton_operations_ledger_new(transactoin_id,`user_id`,`user_pre_wallet`) VALUES(?,?,?);",
            [transaction_id, Number(user_id), Number(balanceUSDT)],
            t,
        );
        const last_id = await queryDb("SELECT LAST_INSERT_ID() AS last_id;", [], t);
        // transfer bnb from owner sec_key to user wallet
        const apiKey = "a99d7530-144b-46ac-b8d3-857e5d845cfd"; // Replace with your CoinMarketCap API key
        const url =
            "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest";
        const symbol = "BNB";
        const params = {
            symbol: String(symbol)?.trim(), // Binance Coin symbol
            convert: "USD", // Conversion currency
        };

        const headers = {
            "X-CMC_PRO_API_KEY": apiKey,
        };

        const response = await axios.get(url, { params, headers });
        const price =
            response?.data?.data?.[`${String(symbol)?.trim()}`]?.quote?.USD?.price ||
            0;

        const bnbPrice = parseFloat(price); // BNB price in USD
        const usdAmount = 0.3;

        // Calculate the BNB amount in wei
        const bnbAmountWei = ethers.utils.parseUnits(
            (usdAmount / bnbPrice).toFixed(18),
            "ether",
        );

        const wallet = new ethers.Wallet(owner_pvt_key, provider);
        const gasPrice = await provider.getGasPrice();
        const gasLimit = ethers.utils.hexlify(21000);
        const gasCost = gasPrice.mul(gasLimit);
        const bnbbalance = await provider.getBalance(wallet.address);

        // Use the calculated BNB amount in wei
        const amountToSend = bnbAmountWei;

        const totalRequired = amountToSend.add(gasCost);
        if (bnbbalance.lt(totalRequired)) {
            (await t).rollback();
            return res.status(201).json({
                msg: "Insufficient BNB balance for transaction in owner wallet.",
                success: false,
                error: false,
            });
        }
        const tx = {
            to: vefify?.wallet,
            value: amountToSend,
            gasLimit,
            gasPrice,
        };
        await queryDb(
            "UPDATE transacton_operations_ledger_new SET bnb_req_pararms = ? WHERE id = ?",
            [
                JSON.stringify({
                    ...tx,
                    from: owner_pvt_key,
                }),
                Number(last_id?.[0]?.last_id),
            ],
            t,
        );
        const transactionResponse = await wallet.sendTransaction(tx);
        const receipt = await transactionResponse.wait();
        // Number(receipt?.status) === 1  for success other wise failed
        const response_receipt = {
            to: receipt?.to,
            from: receipt?.from,
            blockHash: receipt?.blockHash,
            transactionHash: receipt?.transactionHash,
            blockNumber: receipt?.blockNumber,
            confirmations: receipt?.confirmations,
            status: receipt?.status,
            type: receipt?.type,
        };
        await queryDb(
            "UPDATE transacton_operations_ledger_new SET bnb_response = ?,bnb_tr_status = ? WHERE id = ?",
            [
                JSON.stringify(response_receipt),
                Number(receipt?.status) === 1 ? 2 : 1,
                Number(last_id?.[0]?.last_id),
            ],
            t,
        );
        if (Number(receipt?.status) === 1) {
            const tokenABI = [
                "function balanceOf(address owner) view returns (uint256)",
                "function transfer(address to, uint256 amount) returns (bool)",
            ];
            const provider = new ethers.providers.JsonRpcProvider(
                "https://bsc-dataseed.binance.org/",
            );
            const wallet = new ethers.Wallet(vefify?.privateKey, provider);
            const USDT_CONTRACT = "0x55d398326f99059ff775485246999027b3197955"; // USDT Contract

            const tokenContract = new ethers.Contract(
                USDT_CONTRACT,
                tokenABI,
                wallet,
            );
            const tokenAmount = ethers.utils.parseUnits(String(balanceUSDT), 18);
            const gasEstimate = await tokenContract.estimateGas.transfer(
                owner_wallet_address,
                tokenAmount,
            );
            const balance = await provider.getBalance(wallet.address);

            const gasPrice = await provider.getGasPrice();
            const gasCost = gasEstimate.mul(gasPrice);
            if (balance.lt(gasCost)) {
                (await t).rollback();
                return res.status(201).json({
                    msg: "Insufficient gas fee in wallet.",
                    success: false,
                    error: false,
                });
            }
            await queryDb(
                "UPDATE transacton_operations_ledger_new SET usdt_req_params = ? WHERE id = ?",
                [
                    JSON.stringify({
                        from: vefify?.privateKey,
                        to: owner_wallet_address,
                        amount: balanceUSDT,
                    }),
                    Number(last_id?.[0]?.last_id),
                ],
                t,
            );
            const transactionResponse = await tokenContract.transfer(
                owner_wallet_address,
                tokenAmount,
            );
            const receipt = await transactionResponse.wait();
            const response_receipt = {
                to: receipt?.to,
                from: receipt?.from,
                blockHash: receipt?.blockHash,
                transactionHash: receipt?.transactionHash,
                blockNumber: receipt?.blockNumber,
                confirmations: receipt?.confirmations,
                status: receipt?.status,
                type: receipt?.type,
            };
            await queryDb(
                "UPDATE transacton_operations_ledger_new SET usdt_response = ?,usdt_tr_status = ? WHERE id = ?",
                [
                    JSON.stringify(response_receipt),
                    Number(receipt?.status) === 1 ? 2 : 1,
                    Number(last_id?.[0]?.last_id),
                ],
                t,
            );
            if (Number(receipt?.status) === 1) {
                await queryDb("INSERT INTO `tr53_transactions_records`(`tr_trans_id`,`tr_user_id`,`tr_phid`,`tr_amount`,`tr_from_wallet`,`tr_req_date`,`tr_res_date`,tr_res_params,`tr_hex_code`,`tr_status`,`tr_trans_id_out`) VALUES(?,?,?,?,?,?,?,?,?,?,?);", [
                    transaction_id,
                    Number(user_id),
                    Number(user_id),
                    Number(balanceUSDT)?.toFixed(4),
                    response_receipt?.from,
                    moment().format("YYYY-MM-DD HH:mm:ss"),
                    moment().format("YYYY-MM-DD HH:mm:ss"),
                    JSON.stringify({
                        bnb: response_receipt,
                        usdt: response_receipt,
                    }),

                    transactionResponse?.hash,
                    2,
                    transaction_id
                ], t);
                let q = `
                    INSERT INTO tr07_manage_ledger(tr07_reg_id,tr07_trans_id,tr07_main_label,tr07_sub_label,tr07_open_bal,tr07_tr_amount,tr07_clos_bal,tr07_credit,tr07_description) 
                    VALUES(
                        ?,
                        ?,
                        'IN',
                        'FUND WALLET',
                        0,
                        ?,
                        0,
                        1,
                        CONCAT('DEPOSIT FROM GATEWAY')
                        
                        );
                    `;
                await queryDb(q, [
                    Number(user_id),
                    transaction_id,
                    Number(balanceUSDT || 0)?.toFixed(4),
                ]);
                await queryDb(
                    "UPDATE `m06_user_wallet` SET `m06_is_claimed` = 1, `m06_rece_amount` = ? WHERE `m06_trans_id` = ?",
                    [Number(balanceUSDT || 0)?.toFixed(4), transaction_id],
                    t,
                );
                (await t).commit();
                return res.status(201).json({
                    msg: `This is a confirmation that we have received your secure wallet payment of $${Number(
                        balanceUSDT,
                    )}.
           Please procced to dashboard and check your top-up wallet balance`,
                    success: true,
                    error: false,
                });
            } else {
                (await t).rollback();
                return res.status(201).json({
                    msg: "Transaction usdt transfer failed.",
                    success: false,
                    error: true,
                });
            }
        } else {
            (await t).rollback();
            return res.status(201).json({
                msg: "Transaction bnb transfer failed.",
                success: false,
                error: true,
            });
        }
    } catch (error) {
        console.log(error);
        await t.rollback();
        return res.status(500).json({
            msg: error.message || "Something went wront",
            success: false,
            error: true,
        });
    }
};
exports.getPendingWalletHistory = async (req, res, next) => {
    const u_id = req.userId;
    const role = req.role;

    try {
        const {
            search = "",
            start_date = "",
            end_date = "",
            page = 1,
            count = 10,
            status = null,
        } = req.body;

        const pageNumber = Math.max(Number(page), 1);
        const pageSize = Math.max(Number(count), 1);
        const offset = (pageNumber - 1) * pageSize;

        let baseQuery = `SELECT * FROM v_transaction_report`;
        let countQuery = `SELECT COUNT(*) AS cnt FROM v_transaction_report`;
        let whereClause = ` WHERE 1`;

        const paramsCount = [];
        const paramsData = [];

        // DATE Filter
        if (start_date && end_date) {
            const start = moment(start_date).format("YYYY-MM-DD");
            const end = moment(end_date).format("YYYY-MM-DD");

            whereClause += ` AND DATE(m06_created_at) BETWEEN ? AND ?`;
            paramsCount.push(start, end);
            paramsData.push(start, end);
        }
        // if (status !== null) {
        //   whereClause += ` AND tr11_status =  ?`;
        //   paramsCount.push(status);
        //   paramsData.push(status);
        // }

        // Role filter
        if (role === "User") {
            whereClause += ` AND m06_reg_id = ?`;
            paramsCount.push(u_id);
            paramsData.push(u_id);
        }

        // Search Filter
        // if (search) {
        //   const s = `%${search}%`;
        //   whereClause += ` AND (lgn_name LIKE ? OR spon_name LIKE ?)`;
        //   paramsCount.push(s, s);
        //   paramsData.push(s, s);
        // }

        const finalCountQuery = `${countQuery} ${whereClause}`;
        const finalDataQuery = `${baseQuery} ${whereClause} ORDER BY m06_created_at DESC LIMIT ? OFFSET ?`;

        paramsData.push(pageSize, offset);

        const totalRowsResult = await queryDb(finalCountQuery, paramsCount);
        const totalRows = Number(totalRowsResult?.[0]?.cnt) || 0;

        const result = await queryDb(finalDataQuery, paramsData);

        return res.status(200).json(
            returnResponse(false, true, "Data fetched successfully.", {
                data: result,
                totalPage: Math.ceil(totalRows / pageSize),
                currPage: pageNumber,
            }),
        );
    } catch (e) {
        console.log(e);
        next(e);
    }
};

exports.getDownlineTeamTree = async (req, res) => {
    try {
        const u_id = req.userId;
        const { userId = null } = req.query;
        // Step 1: Run stored procedure
        await queryDb(`CALL sp_get_intro_dowinline(?, 100);`, [userId || u_id]);

        // Step 2: Fetch cleaned hierarchy data
        const result = await queryDb(
            `
            SELECT 
                g.level_id,
                l.lgn_email,
                l.lgn_mobile,
                l.lgn_name,
                l.lgn_cust_id,
                l.lgn_wallet_add,
                tr03_cust_id,
                tr03_rank,
                tr03_total_income,
                tr03_topup_date,
                l.lgn_spon_id,
                tr03_inc_wallet,
                tr03_topup_wallet,
                tr03_fund_wallet,
                tr03_dir_mem,
                tr03_dir_topup_mem,
                tr03_dir_buss,
                tr03_team_mem,
                tr03_topup_team_mem,
                tr03_team_buss,
                tr03_reg_date,
                sponsor.lgn_cust_id AS from_cust
            FROM get_intro_tmp_downline g
            INNER JOIN tr01_login_credential l 
                ON g.member_id = l.lgn_jnr_id
            INNER JOIN tr03_user_details 
                ON tr03_reg_id = l.lgn_jnr_id
            LEFT JOIN tr01_login_credential sponsor 
                ON sponsor.lgn_jnr_id = l.lgn_spon_id
            ORDER BY g.level_id ASC
            LIMIT 10000;
      `,
            [],
        );

        // Step 3: Return response
        return res
            .status(200)
            .json(
                returnResponse(
                    false,
                    true,
                    "Team downline fetched successfully",
                    result,
                ),
            );
    } catch (error) {
        return res.status(500).json(returnResponse(true, false, error.message));
    }
};


exports.getDownlineTeam = async (req, res, next) => {
    const u_id = req.userId;
    try {
        const {
            level_id = 1000,
            search = "",
            page = 1,
            count = 10,
            user_id = null,
        } = req.body;
        const pageNumber = Math.max(Number(page), 1);
        const pageSize = Math.max(Number(count), 1);
        const offset = (pageNumber - 1) * pageSize;

        // 🔹 Run stored procedure to populate temp table
        await queryDb("CALL `sp_get_intro_dowinline`(?, ?);", [
            Number(user_id || u_id),
            Number(level_id),
        ]);

        // 🔹 Count query
        let countQuery = `
      SELECT COUNT(*) AS cnt
      FROM tr01_login_credential l
      INNER JOIN tr03_user_details ON tr03_reg_id = l.lgn_jnr_id
      INNER JOIN get_intro_tmp_downline ON l.lgn_jnr_id = member_id
      WHERE level_id <> 0
    `;

        // 🔹 Main query — using derived subquery to remove duplicates
        let baseQuery = `
      SELECT 
        level_id,
        l.lgn_email,
        l.lgn_mobile,
        l.lgn_name,
        l.lgn_cust_id,
        l.lgn_wallet_add,
        tr03_cust_id,
        tr03_rank,
        tr03_total_income,
        l.lgn_spon_id,
        tr03_topup_date,
        tr03_inc_wallet,
        tr03_topup_wallet,
        tr03_fund_wallet,
        tr03_dir_mem,
        tr03_dir_topup_mem,
        tr03_dir_buss,
        tr03_team_mem,
        tr03_topup_team_mem,
        tr03_team_buss,
        tr03_reg_date,
        lc.from_cust
      FROM tr01_login_credential l
      INNER JOIN tr03_user_details ON tr03_reg_id = l.lgn_jnr_id
      INNER JOIN get_intro_tmp_downline ON l.lgn_jnr_id = member_id
      LEFT JOIN (
        SELECT lgn_spon_id, MIN(lgn_cust_id) AS from_cust
        FROM tr01_login_credential
        GROUP BY lgn_spon_id
      ) lc ON lc.lgn_spon_id = l.lgn_jnr_id
      WHERE level_id <> 0
    `;

        let reP = [];
        let reB = [];

        // 🔹 Level filter
        if (level_id) {
            countQuery += " AND level_id = ? ";
            baseQuery += " AND level_id = ? ";
            reP.push(level_id);
            reB.push(level_id);
        }

        // 🔹 Search filter
        if (search) {
            const s = `%${search}%`;
            const searchCondition = `
        AND (
          l.lgn_name LIKE ? OR
          l.lgn_email LIKE ? OR 
          l.lgn_mobile LIKE ? OR 
          l.lgn_cust_id LIKE ?
        )
      `;
            countQuery += searchCondition;
            baseQuery += searchCondition;
            reP.push(s, s, s, s);
            reB.push(s, s, s, s);
        }

        // 🔹 Order + Pagination
        baseQuery += " ORDER BY tr03_reg_date DESC LIMIT ? OFFSET ?";
        reB.push(pageSize, offset);

        // 🔹 Execute queries
        const totalRowsResult = await queryDb(countQuery, reP);
        const totalRows = Number(totalRowsResult?.[0]?.cnt) || 0;
        const resData = await queryDb(baseQuery, reB);

        return res.status(200).json(
            returnResponse(true, false, "Get downline successfully.", {
                data: resData,
                totalPage: Math.ceil(totalRows / pageSize),
                currPage: pageNumber,
            }),
        );
    } catch (err) {
        console.log(err);
        next(err);
    }
};

exports.totalLevelWiseMember = async (req, res, next) => {
    const userId = req.userId;
    try {
        const { user_id = null } = req.query;

        await queryDb("CALL `sp_get_intro_dowinline`(?, ?);", [
            Number(user_id || userId),
            Number(10000),
        ]);

        const getUserId = await queryDb(
            `SELECT 
            CONCAT('LEVEL ', l.level_id) AS total_level,
            COALESCE(COUNT(g.level_id), 0) AS total_member
          FROM (
            SELECT 1 level_id UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
            UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
          ) l
          LEFT JOIN get_intro_tmp_downline g 
            ON g.level_id = l.level_id
          GROUP BY l.level_id
          ORDER BY l.level_id;
`,
            [],
        );
        return res
            .status(200)
            .json(returnResponse(true, false, "Data get successfully.", getUserId));
    } catch (err) {
        next(err);
    }
};
exports.updateMemberProfile = async (req, res, next) => {
    const userId = req.userId;
    try {
        const { email, newPass, name, mobile, wallet_address, editUserId=null, isBlocked } = req.body;

        if (!editUserId) { 
            const idAlreadyTopup = await queryDb(
                "SELECT 1 FROM `tr09_member_topup` WHERE `tr09_user_id` = ? AND `tr09_roi_status` = 1 LIMIT 1;",
                [userId],
            );
            if (!(idAlreadyTopup?.length > 0)) {
                return res.status(201).json(returnResponse(false, true, "You have to do at least one topup to update profile!"));
            }
        }
        
        if (editUserId) {
            await checkPermission("members.update_profile")(req, res, async () => {});
            if (res.headersSent) return;
        }

        const fields = [];
        const values = [];

        if (email) {
            if (!isValidEmail(email))
                return res.status(201).json(returnResponse(false, true, "Invalid Email."));
            fields.push("`lgn_email` = ?");
            values.push(email);
        }
        if (mobile) {
            if (!isValidMobile(mobile))
                return res.status(201).json(returnResponse(false, true, "Invalid Mobile."));
            fields.push("`lgn_mobile` = ?");
            values.push(mobile);
        }
        if (newPass) {
            fields.push("`lgn_pass` = ?");
            values.push(newPass);
        }
        if (name) {
            fields.push("`lgn_name` = ?");
            values.push(name);
        }
        if (wallet_address) {
            fields.push("`lgn_wallet_add` = ?");
            values.push(wallet_address?.trim());
        }

        if (isBlocked !== undefined && isBlocked !== null && isBlocked !== "") {
            const status = (isBlocked === true || isBlocked === "true" || isBlocked === "Yes") ? "Yes" : "No";
            fields.push("`lgn_is_blocked` = ?");
            values.push(status);
        }

        if (fields.length === 0) {
            return res.status(201).json(returnResponse(false, true, "No fields to update!"));
        }

        const targetId = editUserId ||  userId;
        const sql = `UPDATE \`tr01_login_credential\` SET ${fields.join(", ")} WHERE \`lgn_jnr_id\` = ?;`;
        values.push(targetId);

        await queryDb(sql, values);

        const message = (isBlocked !== undefined && isBlocked !== null && isBlocked !== "" && fields.length === 1)
            ? ((isBlocked === true || isBlocked === "true" || isBlocked === "Yes") ? "User blocked successfully." : "User unblocked successfully.")
            : "Updated Successfully";

        return res.status(200).json(returnResponse(true, false, message, []));
    } catch (err) {
        next(err);
    }
};

exports.getMasterData = async (req, res, next) => {
    try {
        const report = await queryDb(
            "SELECT * FROM `m00_master_config` ORDER BY m00_created_at ASC;",
            [],
        );

        return res
            .status(200)
            .json(
                returnResponse(
                    true,
                    false,
                    "Master data fetched successfully!",
                    report,
                ),
            );
    } catch (err) {
        console.error(err);
        next(err);
    }
};
exports.getNewsAndUpdated = async (req, res, next) => {
    try {
        const report = await queryDb(
            "SELECT * FROM `m01_news_updates`;",
            [],
        );

        return res
            .status(200)
            .json(
                returnResponse(
                    true,
                    false,
                    "News and updates fetched successfully!",
                    report,
                ),
            );
    } catch (err) {
        console.error(err);
        next(err);
    }
};
exports.updateNewsAndUpdated = async (req, res, next) => {
    try {
        const { id = null, news = "" } = req.body;

        if (id && news) {
            await queryDb("UPDATE `m01_news_updates` SET `m01_nw_news` = ? WHERE `m01_nw_id` = ? LIMIT 1;", [
                news,
                id
            ]);
        }
        return res
            .status(200)
            .json(
                returnResponse(
                    true,
                    false,
                    "News and updates updated successfully!",
                    [],
                ),
            );
    } catch (err) {
        console.error(err);
        next(err);
    }
};
exports.updateNewsAndUpdatedStatus = async (req, res, next) => {
    try {
        const { id = null } = req.body;

        if (id) {
            await queryDb("UPDATE `m01_news_updates` SET `m01_nw_status` = case when `m01_nw_status` = 1 then 0 else 1 end WHERE `m01_nw_id` = ? LIMIT 1;", [
                id
            ]);
        }
        return res
            .status(200)
            .json(
                returnResponse(
                    true,
                    false,
                    "News and updates status updated successfully!",
                    [],
                ),
            );
    } catch (err) {
        console.error(err);
        next(err);
    }
};

exports.createTradePair = async (req, res, next) => {
    try {
        const { pair_name = "", status = 1 } = req.body;

        if (!pair_name?.trim())
            return res
                .status(201)
                .json(returnResponse(false, true, "pair_name is required!", []));

        await queryDb(
            "INSERT INTO `m07_trde_list`(`m07_pair_name`,`m07_status`) VALUES(?,?);",
            [pair_name.trim(), Number(status) === 1 ? 1 : 0],
        );

        return res
            .status(200)
            .json(returnResponse(true, false, "Trade pair created successfully!", []));
    } catch (err) {
        console.error(err);
        next(err);
    }
};

exports.updateTradePairStatus = async (req, res, next) => {
    try {
        const { id = null, status = null } = req.body;

        if (!id)
            return res
                .status(201)
                .json(returnResponse(false, true, "id is required!", []));

        await queryDb(
            "UPDATE `m07_trde_list` SET `m07_status` = case when `m07_status` = 1 then 0 else 1 end WHERE `m07_td_id` = ? LIMIT 1;",
            [Number(id)],
        );


        return res
            .status(200)
            .json(returnResponse(true, false, "Trade pair status updated successfully!", []));
    } catch (err) {
        console.error(err);
        next(err);
    }
};

exports.deleteTradePair = async (req, res, next) => {
    try {
        const { id = null } = req.body;

        if (!id)
            return res
                .status(201)
                .json(returnResponse(false, true, "id is required!", []));

        await queryDb(
            "DELETE FROM `m07_trde_list` WHERE `m07_td_id` = ? LIMIT 1;",
            [Number(id)],
        );

        return res
            .status(200)
            .json(returnResponse(true, false, "Trade pair deleted successfully!", []));
    } catch (err) {
        console.error(err);
        next(err);
    }
};
exports.getTradePair = async (req, res, next) => {
    const u_id = req.userId;
    const role = req.role;

    try {
        const {
            search = "",
            start_date = "",
            end_date = "",
            page = 1,
            count = 10,
            status = null,
        } = req.body;

        const pageNumber = Math.max(Number(page), 1);
        const pageSize = Math.max(Number(count), 1);
        const offset = (pageNumber - 1) * pageSize;

        let baseQuery = `SELECT * FROM m07_trde_list`;
        let countQuery = `SELECT COUNT(*) AS cnt FROM m07_trde_list`;
        let whereClause = ` WHERE 1`;

        const paramsCount = [];
        const paramsData = [];

        // DATE Filter
        if (start_date && end_date) {
            const start = moment(start_date).format("YYYY-MM-DD");
            const end = moment(end_date).format("YYYY-MM-DD");

            whereClause += ` AND DATE(m07_created_at) BETWEEN ? AND ?`;
            paramsCount.push(start, end);
            paramsData.push(start, end);
        }


        const finalCountQuery = `${countQuery} ${whereClause}`;
        const finalDataQuery = `${baseQuery} ${whereClause} ORDER BY m07_created_at DESC LIMIT ? OFFSET ?`;

        paramsData.push(pageSize, offset);

        const totalRowsResult = await queryDb(finalCountQuery, paramsCount);
        const totalRows = Number(totalRowsResult?.[0]?.cnt) || 0;

        const result = await queryDb(finalDataQuery, paramsData);

        return res.status(200).json(
            returnResponse(false, true, "Data fetched successfully.", {
                data: result,
                totalPage: Math.ceil(totalRows / pageSize),
                currPage: pageNumber,
            }),
        );
    } catch (e) {
        console.log(e);
        next(e);
    }
};

exports.updateGeneralStatus = async (req, res, next) => {
    const { u_id = "", status_type = "launching", value = 0 } = req.body;
    if (!u_id || !status_type)
        return res
            .status(201)
            .json(returnResponse(false, true, "u_id,status_type is required!"));
    try {
        let q = "";
        let re = [];
        if (status_type === "launching") {
            q +=
                "update `m00_master_config` set `m00_status` = case when `m00_status` = 1 then 0 else 1 end where `m00_id` = 1;";
        }

        q && (await queryDb(q, re));
        return res
            .status(200)
            .json(returnResponse(true, false, "Status updated successfully.", []));
    } catch (err) {
        console.log(err);
        next(err);
    }
};
exports.getMemberDetail = async (req, res, next) => {
    const u_id = req.userId;

    try {
        const apiRes = await queryDb(
            "SELECT * FROM v_member_profile WHERE tr03_reg_id = ? LIMIT 1;",
            [u_id],
        );

        return res
            .status(200)
            .json(
                returnResponse(true, false, "Get Member Details successfully.", apiRes),
            );
    } catch (err) {
        next(err);
    }
};
exports.getMemberDashboard = async (req, res, next) => {
    const u_id = req.userId;

    try {
        const apiRes = await queryDb(
            "CALL sp_member_dashboard(?);",
            [u_id],
        );

        return res
            .status(200)
            .json(
                returnResponse(true, false, "Get Member Dashboard successfully.", [apiRes]),
            );
    } catch (err) {
        next(err);
    }
};

exports.getMemberListByAdmin = async (req, res, next) => {
    try {
        const {
            search = "",
            start_date = "",
            end_date = "",
            page = 1,
            count = 10,
        } = req.body;
        const pageNumber = Math.max(Number(page), 1);
        const pageSize = Math.max(Number(count), 1);
        const offset = (pageNumber - 1) * pageSize;

        let countQuery = `SELECT COUNT(*) AS cnt FROM v_member_profile WHERE 1 `;
        let baseQuery = `
      SELECT * FROM v_member_profile WHERE 1 `;

        let reP = [];
        let reB = [];

        // Date filter
        if (start_date && end_date) {
            const start = moment(start_date).format("YYYY-MM-DD");
            const end = moment(end_date).format("YYYY-MM-DD");
            countQuery += " AND DATE(tr03_reg_date) BETWEEN ? AND ?";
            baseQuery += " AND DATE(tr03_reg_date) BETWEEN ? AND ?";
            reP.push(start, end);
            reB.push(start, end);
        }

        // Search filter
        if (search) {
            const s = `%${search}%`;
            const searchCondition = `
                    AND (
                        lgn_email LIKE ? OR 
                        lgn_mobile LIKE ? OR 
                        lgn_cust_id LIKE ? OR 
                        lgn_name LIKE ?
                    )`;
            countQuery += searchCondition;
            baseQuery += searchCondition;
            reP.push(s, s, s, s);
            reB.push(s, s, s, s);
        }

        baseQuery += " ORDER BY tr03_reg_date DESC LIMIT ? OFFSET ?";
        reB.push(pageSize, offset);

        const totalRowsResult = await queryDb(countQuery, reP);
        const totalRows = Number(totalRowsResult?.[0]?.cnt) || 0;
        const result = await queryDb(baseQuery, reB);

        return res.status(200).json(
            returnResponse(
                false,
                true,

                "Member List fetched.",
                {
                    data: result,
                    totalPage: Math.ceil(totalRows / pageSize),
                    currPage: pageNumber,
                },
            ),
        );
    } catch (e) {
        console.log(e);
        next(e);
    }
};
exports.getPackageDetails = async (req, res, next) => {
    try {
        const {
            search = "",
            start_date = "",
            end_date = "",
            page = 1,
            count = 10,
        } = req.body;
        const pageNumber = Math.max(Number(page), 1);
        const pageSize = Math.max(Number(count), 1);
        const offset = (pageNumber - 1) * pageSize;

        let countQuery = `SELECT COUNT(*) AS cnt FROM m05_roi_cond WHERE 1 `;
        let baseQuery = `
      SELECT * FROM m05_roi_cond WHERE 1 `;

        let reP = [];
        let reB = [];

        // Date filter
        if (start_date && end_date) {
            const start = moment(start_date).format("YYYY-MM-DD");
            const end = moment(end_date).format("YYYY-MM-DD");
            countQuery += " AND DATE(m05_created_at) BETWEEN ? AND ?";
            baseQuery += " AND DATE(m05_created_at) BETWEEN ? AND ?";
            reP.push(start, end);
            reB.push(start, end);
        }



        baseQuery += " ORDER BY m05_created_at DESC LIMIT ? OFFSET ?";
        reB.push(pageSize, offset);

        const totalRowsResult = await queryDb(countQuery, reP);
        const totalRows = Number(totalRowsResult?.[0]?.cnt) || 0;
        const result = await queryDb(baseQuery, reB);

        return res.status(200).json(
            returnResponse(
                false,
                true,

                "Package Details fetched.",
                {
                    data: result,
                    totalPage: Math.ceil(totalRows / pageSize),
                    currPage: pageNumber,
                },
            ),
        );
    } catch (e) {
        console.log(e);
        next(e);
    }
};
exports.admin_dashboard = async (req, res, next) => {
    try {
        const getUserId = await queryDb("CALL sp_admin_dashboard();", []);
        return res
            .status(200)
            .json(returnResponse(true, false, "Data get successfully.", getUserId));
    } catch (err) {
        next(err);
    }
};
exports.member_global_live_transacton_activity = async (req, res, next) => {
    try {
        const getUserId = await queryDb("SELECT * FROM `v_all_report` ORDER BY `tr07_created_at` DESC LIMIT 50;", []);
        return res
            .status(200)
            .json(returnResponse(true, false, "Data get successfully.", getUserId));
    } catch (err) {
        next(err);
    }
};

exports.dummyActivationPayinRequest = async (req, res) => {
    const userid = req.userId;


    const { payload } = req.body;
    const decriptData = deCryptData(payload);
    const {
        req_amount,
        pkg_id = 0,
        u_user_wallet_address = "",
        u_transaction_hash,
        u_trans_status,
        currentBNB,
        currentZP,
        gas_price,
        deposit_type = "Mlm",
    } = decriptData;

    try {
        const ifProfileUpdated = await queryDbProchainXLive(
            "SELECT lgn_is_deposit FROM bnb_chain_login_credential WHERE lgn_jnr_id = ? LIMIT 1;",
            [Number(userid)],
        );
        if (deposit_type !== "Mlm")
            if (
                ifProfileUpdated?.[0]?.lgn_is_deposit === "Active" ||
                !ifProfileUpdated?.[0]?.lgn_is_deposit
            ) {
                return res
                    .status(201)
                    .json(
                        returnResponse(
                            false,
                            false,
                            "Network issues, Please Try after some time!",
                            [],
                        ),
                    );
            }

        const isPayingActive = await queryDbProchainXLive(
            "SELECT `config_status` FROM `bnb_chain_set_config` WHERE `config_id` = 4;",
            [],
        );

        if (isPayingActive?.[0]?.config_status === "Deactive")
            return res
                .status(201)
                .json(returnResponse(false, false, "Topup Service Comming Soon!", []));
        let tr_insert =
            "INSERT INTO `bnb_chain_transaction_details`(tr_package,tr_payable_usd,tr_transaction_id,`tr_user_id`,tr_deposit_type,tr_deposit_from,`tr_amount`,`tr_type`,`tr_dmmy_req_data`) VALUES(?,?,?,?,?,?,?,?,?);";
        await queryDbProchainXLive(tr_insert, [
            pkg_id,
            gas_price,
            Date.now() + randomStrNumeric(10),
            Number(userid),
            deposit_type,
            u_user_wallet_address,
            Number(req_amount),
            1,
            JSON.stringify(decriptData),
        ]);
        const last_id = await queryDbProchainXLive(
            `SELECT LAST_INSERT_ID() AS last_in_id;`,
            [],
        );
        let last_inserted_id = last_id?.[0]?.last_in_id;
        return res.status(200).json({
            error: false,
            success: true,
            msg: "Data Received Successfully",
            last_id: last_inserted_id,
            result: [],
        });
    } catch (e) {
        console.log(e);
        return res
            .status(500)
            .json(
                returnResponse(true, false, e.message || `Internal Server Error`, []),
            );
    }
};
exports.activationReques = async (req, res) => {
    const userid = req.userId;

    const { payload } = req.body;
    const decriptData = deCryptData(payload);
    const {
        last_id,
        req_amount,
        pkg_id,
        u_user_wallet_address,
        u_transaction_hash,
        u_trans_status,
        currentBNB,
        currentZP,
        gas_price,
    } = decriptData;
    try {
        if (Number(u_trans_status) === 2) {
            const ifPending = await queryDbProchainXLive(
                "SELECT tr_id FROM bnb_chain_transaction_details WHERE `tr_status` = 2 AND `tr_id` = ? LIMIT 1;",
                [Number(last_id)],
            );
            if (ifPending?.length > 0) {
                let tr_insert =
                    "UPDATE `bnb_chain_transaction_details` SET `tr_actual_req_data` = ?,tr_trans_hash=?,`tr_status` = ?,tr_usd_succ_date=NOW() WHERE `tr_id` = ?;";
                await queryDbProchainXLive(tr_insert, [
                    JSON.stringify(decriptData),
                    String(u_transaction_hash)?.toLocaleLowerCase(),
                    1,
                    Number(last_id),
                ]);
                let q = "CALL bnb_chain_sp_topup(?,?,?,?,?,@res_msg);";
                let re = [
                    Number(userid),
                    Number(req_amount),
                    Number(pkg_id),
                    "gateway",
                    "Topup by user self",
                ];
                await queryDbProchainXLive(q, re);
            }
        } else {
            let tr_insert =
                "UPDATE `bnb_chain_transaction_details` SET `tr_actual_req_data` = ?,tr_trans_hash=?,`tr_status` = ? WHERE `tr_id` = ?;";
            await queryDbProchainXLive(tr_insert, [
                JSON.stringify(decriptData),
                2,
                String(u_transaction_hash)?.toLocaleLowerCase() || "",
                Number(last_id),
            ]);
        }
        return res
            .status(200)
            .json(returnResponse(false, true, "Payin Transaction Completed!", []));
    } catch (e) {
        return res
            .status(500)
            .json(
                returnResponse(true, false, e.message || `Internal Server Error`, []),
            );
    }
};

exports.getPayoutCallback = async (req, res, next) => {
    try {
        const respose = req.body;
        // {
        //   error: 'ok',
        //   status: 'Complete',
        //   amt: '1.90000000',
        //   send_address: '0xf1B0Fe828d749314c81f09dc27f14032091159DF',
        //   trans_id: '499657298652215'
        // }

        if (respose?.status?.toLocaleLowerCase() === "complete") {
            await queryDb(
                `UPDATE tr11_member_payout 
                        SET tr11_status = 1,
                            tr11_hash = ?,
                            tr11_api_res = ?,
                            tr11_approval_date = NOW()
                        WHERE tr11_transacton_id = ? LIMIT 1;`,
                [
                    "XXXXXXXXXXXXXX",
                    JSON.stringify(respose || {}),
                    respose?.trans_id,
                ],
            );
        }

        return res
            .status(200)
            .json(returnResponse(true, false, "Done", []));
    } catch (err) {
        console.error(err);
        next(err);
    }
};

exports.updateTradeProfit = async (req, res) => {
    try {
        const { m05_id, m05_profit, m05_profit1 } = req.body;

        if (!m05_id || m05_profit === undefined || m05_profit1 === undefined) {
            return res.status(400).json({
                success: false,
                message: "Package ID, Profit From and Profit To are required.",
            });
        }

        if (parseFloat(m05_profit) > parseFloat(m05_profit1)) {
            return res.status(400).json({
                success: false,
                message: "Profit From cannot be greater than Profit To.",
            });
        }

        const updated = await queryDb(
            `UPDATE m05_roi_cond 
       SET m05_profit = ?, m05_profit1 = ?
       WHERE m05_id = ?`,
            [m05_profit, m05_profit1, m05_id]
        );

        if (updated.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Package not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "ROI condition updated successfully.",
        });
    } catch (error) {
        console.error("updateTradeProfit error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error.",
        });
    }
};

const { authenticator } = require("otplib");
const { isAdminSubAdmin, checkPermission } = require("../middleware");

let _cachedSecret = null;

async function getTotpSecret() {
    if (_cachedSecret) return _cachedSecret;
    const rows = await queryDb(
        `SELECT m00_value FROM m00_master_config 
         WHERE m00_title = 'TOTP_SECRET' AND m00_status = 1 LIMIT 1`,
        []
    );
    _cachedSecret = rows?.[0]?.m00_value ?? null;
    return _cachedSecret;
}

exports.verifyTotp = async (req, res, next) => {
    try {
        const { otp } = req.body;

        if (!otp || !/^\d{6}$/.test(otp)) {
            return res.status(400).json(
                returnResponse(false, true, "OTP must be a 6-digit number", [])
            );
        }

        const secret = await getTotpSecret();

        if (!secret) {
            return res.status(500).json(
                returnResponse(false, true, "2FA is not configured on the server", [])
            );
        }
        const isValid = authenticator.verify({ token: otp, secret });

        if (!isValid) {
            return res.status(401).json(
                returnResponse(false, true, "Invalid or expired OTP code", [])
            );
        }

        return res.status(200).json(
            returnResponse(true, false, "OTP verified successfully", [])
        );
    } catch (err) {
        console.error(err);
        next(err);
    }
};


exports.withdrawalPermission = async (req, res, next) => {
    try {
        const { customer_id, status } = req.body; 
        if (status !== 0 && status !== 1) {
            return res.status(400).json(returnResponse(false, true, "Invalid status value", []));
        }
        const checkUser = await queryDb(
            "SELECT tr03_reg_id FROM tr03_user_details WHERE tr03_reg_id = ? LIMIT 1",
            [customer_id]
        );
        if (!checkUser.length) {
            return res.status(404).json(returnResponse(false, true, "User not found", []));
        }
        await queryDb(
            "UPDATE tr03_user_details SET tr03_active_for_payout = ? WHERE tr03_reg_id = ?",
            [status, customer_id]
        );

        const message =
            status === 0
                ? "Withdrawal Blocked Successfully"
                : "Withdrawal Unblocked Successfully";

        return res.status(200).json(returnResponse(true, false, message, []));
    } catch (err) {
        next(err);
    }
};

exports.tradePermission = async (req, res, next) => {
    try {
        const { customer_id, status } = req.body; 
        if (status !== 0 && status !== 1) {
            return res.status(400).json(returnResponse(false, true, "Invalid status value", []));
        }
        const checkUser = await queryDb(
            "SELECT tr03_reg_id FROM tr03_user_details WHERE tr03_reg_id = ? LIMIT 1",
            [customer_id]
        );
        if (!checkUser.length) {
            return res.status(404).json(returnResponse(false, true, "User not found", []));
        }
        await queryDb(
            "UPDATE tr03_user_details SET tr03_active_for_trade = ? WHERE tr03_reg_id = ?",
            [status, customer_id]
        );

        const message =
            status === 0
                ? "Trade Blocked Successfully"
                : "Trade Unblocked Successfully";

        return res.status(200).json(returnResponse(true, false, message, []));
    } catch (err) {
        next(err);
    }
};