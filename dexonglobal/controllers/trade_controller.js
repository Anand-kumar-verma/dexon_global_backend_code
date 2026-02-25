const { returnResponse } = require("../helper/helperResponse");
const { queryDb } = require("../helper/utilityHelper");

exports.getMyTrades = async (req, res, next) => {
  const userId = req.userId;
  try {
    const check = await queryDb(
      `SELECT COUNT(*) AS cnt
       FROM tr12_member_trades
       WHERE tr12_reg_id = ?
         AND tr12_pair_name = 'SYSTEM/ROI'
         AND DATE(tr12_created_at) = CURDATE()`,
      [userId]
    );

    if (Number(check?.[0]?.cnt || 0) === 0) {
      await queryDb(`CALL sp_daily_trade_closing(?);`, [userId]);
    }

    const trades = await queryDb(
      `SELECT
         tr12_mt_id          AS id,
         tr12_trans_id       AS transaction,
         tr12_pair_name      AS pair,
         tr12_pnl            AS pnl,
         tr12_crypto_name    AS coin,
         tr12_order_position AS position,
         DATE(tr12_created_at)     AS closedAt
       FROM tr12_member_trades
       WHERE tr12_reg_id = ?
       ORDER BY tr12_created_at DESC`,
      [userId]
    );
    console.log(trades)

    return res.status(200).json(
      returnResponse(true, false, "Trades fetched successfully.", trades)
    );
  } catch (err) {
    console.error("getMyTrades error:", err);
    next(err);
  }
};