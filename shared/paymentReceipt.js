// A delivery state alone is never proof of payment.
export function paymentReceiptState(order,payment){
 if(payment?.estado_pago==='rechazado')return 'rejected';
 if(order?.estado==='cancelado'||payment?.estado_pago==='cancelado')return 'cancelled';
 if(!order||!payment)return 'unverified';
 const referenceMatches=typeof order.referencia==='string'&&!!order.referencia&&payment.referencia===order.referencia;
 const amount=Number(payment.monto),total=Number(order.total);
 const amountMatches=payment.monto!==null&&payment.monto!==undefined&&Number.isFinite(amount)&&Number.isFinite(total)&&total>0&&Math.round(amount*100)===Math.round(total*100);
 const transactionRecorded=typeof payment.transaccion==='string'&&!!payment.transaccion.trim();
 if(['pagado','empacando','enviado','entregado'].includes(order.estado)&&payment.estado_pago==='aprobado'&&referenceMatches&&amountMatches&&transactionRecorded)return 'confirmed';
 if(order.estado==='pendiente'&&payment.estado_pago==='pendiente')return 'pending';
 return 'unverified';
}

export function canPrintReceipt(result,expectedTransaction){
 return result?.receiptAllowed===true&&paymentReceiptState(result.order,result.payment)==='confirmed'&&(!expectedTransaction||expectedTransaction===result.payment.transaccion);
}
