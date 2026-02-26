const { returnResponse } = require("../helper/helperResponse");
const { queryDb } = require("../helper/utilityHelper");

exports.getMyTrades = async (req, res, next) => {
  const userId = req.userId;
  try {
    const trades = await queryDb(
      `SELECT
         tr12_mt_id          AS id,
         tr12_trans_id       AS transaction,
         tr12_pnl            AS pnl,
         tr12_order_type     AS type,
         tr12_crypto_name    AS coin,
         tr12_order_position AS position,
         DATE(tr12_created_at)     AS closedAt
       FROM tr12_member_trades
       WHERE tr12_reg_id = ?
       ORDER BY tr12_created_at DESC`,
      [userId]
    );

    return res.status(200).json(
      returnResponse(true, false, "Trades fetched successfully.", trades)
    );
  } catch (err) {
    console.error("getMyTrades error:", err);
    next(err);
  }
};