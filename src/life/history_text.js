export function historyText(item){
 const value=item?.result??item?.text??item?.eventId??item?.kind??'olay';
 if(typeof value==='string')return value;
 if(value&&typeof value.text==='string')return value.text;
 if(value&&typeof value.label==='string')return value.label;
 if(item?.eventId)return item.eventId;
 if(item?.kind==='social-activity')return 'Sosyal etkinlik yaptın.';
 if(item?.kind==='physical-activity')return 'Fiziksel aktivite yaptın.';
 if(item?.kind==='hobby')return 'Hobinle ilgilendin.';
 if(item?.kind==='activity')return 'Yıllık aksiyon tamamlandı.';
 return 'Hayatında bir gelişme oldu.';
}
