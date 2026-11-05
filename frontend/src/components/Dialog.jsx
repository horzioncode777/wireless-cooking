import { useEffect, useEffectEvent, useRef } from 'react';

export default function Dialog({children,label,onClose,className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4',...props}) {
  const ref=useRef(null);
  const close=useEffectEvent(()=>onClose?.());
  useEffect(()=>{
    const previous=document.activeElement;
    const element=ref.current;
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    element.focus();
    const keyboard=event=>{
      if(event.key==='Escape'){event.preventDefault();close();return;}
      if(event.key!=='Tab') return;
      const items=[...element.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(item=>item.getClientRects().length>0);
      if(!items.length){event.preventDefault();return;}
      const first=items[0],last=items.at(-1);
      if(event.shiftKey && (document.activeElement===first||document.activeElement===element)){event.preventDefault();last.focus();}
      else if(!event.shiftKey && (document.activeElement===last||document.activeElement===element)){event.preventDefault();first.focus();}
    };
    element.addEventListener('keydown',keyboard);
    return()=>{element.removeEventListener('keydown',keyboard);document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};
  },[]);
  return <div {...props} ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className={className}>{children}</div>;
}
