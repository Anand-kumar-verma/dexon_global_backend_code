const { returnResponse } = require("../helper/helperResponse");
const { queryDb } = require("../helper/utilityHelper");

exports.userMessage = async (req, res, next) => {
    const userId = req.userId;
    try {
        const { message = "" } = req.body;

        if (!message.trim())
            return res
                .status(201)
                .json(returnResponse(false, true, "Message is required!"));
        const apiRes = await queryDb(
            "INSERT INTO `tr54_ticket_support`(`tr54_reg_id`,`tr54_user_msg`) VALUES(?,?);",
            [userId, message?.trim()],
        );
        return res
            .status(200)
            .json(
                returnResponse(true, false, "Message sent successfully.", apiRes),
            );
    } catch (err) {
        next(err);
    }
};
exports.adminReply = async (req, res, next) => {
    const userId = req.userId;
    try {
        const { message = "", msg_id = null } = req.body;

        if (!message.trim())
            return res
                .status(201)
                .json(returnResponse(false, true, "Message is required!"));
        const apiRes = await queryDb(
            "UPDATE `tr54_ticket_support` SET `tr54_reply` = ?,`tr54_reply_date`=NOW(),`tr54_status`=1 WHERE `tr54_id` = ?;",
            [message?.trim(), msg_id],
        );
        return res
            .status(200)
            .json(
                returnResponse(true, false, "Message sent successfully.", apiRes),
            );
    } catch (err) {
        next(err);
    }
};

exports.getMessaage = async (req, res, next) => {
    const u_id = req.userId;
    const role = req.role;
    try {
        const {
            search = "",
            start_date = "",
            end_date = "",
            page = 1,
            count = 10,
            order = "ASC",
        } = req.body;

        const pageNumber = Math.max(Number(page), 1);
        const pageSize = Math.max(Number(count), 1);
        const offset = (pageNumber - 1) * pageSize;

        let baseQuery = `SELECT * FROM v_ticket_and_support`;
        let countQuery = `SELECT COUNT(*) AS cnt FROM v_ticket_and_support`;
        let whereClause = ` WHERE 1`;

        const paramsCount = [];
        const paramsData = [];

        // DATE Filter
        if (start_date && end_date) {
            const start = moment(start_date).format("YYYY-MM-DD");
            const end = moment(end_date).format("YYYY-MM-DD");

            whereClause += ` AND DATE(tr54_msg_date) BETWEEN ? AND ?`;
            paramsCount.push(start, end);
            paramsData.push(start, end);
        }

        // Role filter
        if (role === "User") {
            whereClause += ` AND tr54_reg_id = ?`;
            paramsCount.push(u_id);
            paramsData.push(u_id);
        }

        const finalCountQuery = `${countQuery} ${whereClause}`;
        const finalDataQuery = `${baseQuery} ${whereClause} ORDER BY tr54_msg_date ${order} LIMIT ? OFFSET ?`;

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