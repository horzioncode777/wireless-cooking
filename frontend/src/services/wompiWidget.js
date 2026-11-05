const widgetSource='https://checkout.wompi.co/widget.js';
let widgetLoading;

export function validateWidgetConfiguration(config) {
  if(!config||!/^pub_(?:test|prod)_[\w-]+$/.test(config.publicKey)||config.currency!=='COP'||!Number.isSafeInteger(config.amountInCents)||config.amountInCents<=0||typeof config.reference!=='string'||config.reference.length>100||!config.reference||!/^[0-9a-f]{64}$/i.test(config.signature?.integrity)) throw Error('Los datos del pago no son válidos. Retoma el pago desde tu pedido.');
  // Allow only fields supplied by our server; never pass arbitrary SDK options.
  return {publicKey:config.publicKey,currency:'COP',amountInCents:config.amountInCents,reference:config.reference,signature:{integrity:config.signature.integrity},...(typeof config.customerData?.email==='string'?{customerData:{email:config.customerData.email}}:{})};
}

async function loadWidget() {
  if(typeof window.WidgetCheckout==='function')return window.WidgetCheckout;
  if(!widgetLoading){
    widgetLoading=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=widgetSource;script.async=true;
      const timeout=setTimeout(()=>failed(),15000);
      function failed(){clearTimeout(timeout);script.remove();reject(Error('No se pudo cargar Wompi. Revisa la conexión y retoma el pago desde tu pedido.'));}
      script.onerror=failed;
      script.onload=()=>{clearTimeout(timeout);if(typeof window.WidgetCheckout==='function')resolve(window.WidgetCheckout);else failed();};
      document.head.appendChild(script);
    }).catch(error=>{widgetLoading=undefined;throw error;});
  }
  return widgetLoading;
}

export async function openWompiWidget(configuration, onTransaction) {
  const config=validateWidgetConfiguration(configuration);
  const WidgetCheckout=await loadWidget();
  const widget=new WidgetCheckout(config);
  widget.open(result=>{
    const id=result?.transaction?.id;
    if(typeof id==='string'&&/^[a-zA-Z0-9-]{3,100}$/.test(id))onTransaction?.(id);
  });
  // Return immediately: the user can close the official widget without paying.
  // The order page remains underneath, ready to resume the same pending order.
}
