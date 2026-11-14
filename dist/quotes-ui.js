let quoteData={configured:null,items:[]},quoteBusy=false,quoteError='',quoteEpoch=0,quoteReload=false,quoteFreeSelected=false,quoteWidgetRevision=0;
function resetQuotes(){quoteEpoch++;quoteBusy=false;quoteReload=false;quoteFreeSelected=false;quoteWidgetRevision=0;quoteData={configured:null,items:[]};quoteError='';}
function followedQuoteRows(){return state.watchlist.filter(symbol=>stocks.some(company=>company.symbol===symbol)).map(symbol=>({symbol,item:quoteData.items.find(item=>item.symbol===symbol)}));}
function useFreeQuotes(rows=followedQuoteRows()){
  return rows.length>0&&(quoteFreeSelected||quoteData.configured===false||((quoteError||quoteData.items.length>0)&&rows.every(({item})=>!item?.quote)));
}
function quoteWidgetKey(){return JSON.stringify([state.watchlist,document.documentElement.dataset.theme,quoteWidgetRevision]);}
function updateQuotePanel(){
  const panel=document.querySelector('#quotes-panel');if(!panel||!currentUser)return;
  // Keep an existing provider connection while the optional API check finishes.
  if(panel.dataset.mode==='widget'&&useFreeQuotes()&&panel.dataset.widgetKey===quoteWidgetKey()){
    const button=panel.querySelector('[data-refresh-quotes]');button.disabled=quoteBusy;button.textContent=quoteBusy?'กำลังดึงราคา…':'อัปเดตราคา';return;
  }
  panel.outerHTML=quotePanel();
}
async function loadQuotes(){
  if(!currentUser)return;if(quoteBusy){quoteReload=true;return;}
  const epoch=++quoteEpoch,userId=currentUser.id,symbols=state.watchlist.join(',');quoteBusy=true;quoteError='';updateQuotePanel();
  try{
    const result=await api('/api/quotes');if(epoch!==quoteEpoch||currentUser?.id!==userId)return;
    if(symbols===state.watchlist.join(','))quoteData=result;else quoteReload=true;
  }catch(error){if(epoch!==quoteEpoch)return;quoteError=error.message;if(error.status===401)showSignedOut('login');}
  finally{if(epoch===quoteEpoch){quoteBusy=false;updateQuotePanel();if(quoteReload){quoteReload=false;loadQuotes();}}}
}
function freeQuoteTable(rows){
  const settings={width:'100%',height:'100%',symbolsGroups:[{name:'บริษัทที่ติดตาม',symbols:rows.map(({symbol})=>({name:symbol,displayName:symbol+' · '+stock(symbol).name}))}],showSymbolLogo:true,colorTheme:document.documentElement.dataset.theme==='light'?'light':'dark',isTransparent:false,backgroundColor:document.documentElement.dataset.theme==='light'?'#ffffff':'#211b2c',locale:'th','page-uri':location.origin};
  const src='https://www.tradingview-widget.com/embed-widget/market-quotes/?locale=th#'+encodeURIComponent(JSON.stringify(settings));
  const height=Math.min(540,Math.max(170,100+rows.length*45));
  return `<p class="quote-provider">TradingView <span>ข้อมูลล่าช้าตามตลาด</span></p><div class="table-wrap quote-widget-wrap" style="height:${height}px"><iframe class="quote-widget" loading="lazy" title="ราคาหุ้นของบริษัทที่ติดตามจาก TradingView" src="${escapeHtml(src)}" referrerpolicy="origin" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe></div><div class="tradingview-widget-copyright quote-attribution"><a href="https://www.tradingview.com/markets/" target="_blank" rel="noopener noreferrer nofollow">Track all markets on TradingView</a><span>เปิดตาราง ${escapeHtml(dateLabel(new Date().toISOString()))}</span></div><p class="small-note">ตารางโหลดจาก TradingView โดยตรง · ราคามีความล่าช้า เมื่อปิดตลาดอาจเป็นราคาวันซื้อขายล่าสุด</p><details class="quote-links"><summary>เปิดราคาที่ผู้ให้บริการ หากตารางไม่แสดง</summary><div>${rows.map(({symbol})=>`<a href="https://www.tradingview.com/symbols/${encodeURIComponent(symbol)}/" target="_blank" rel="noopener noreferrer">${escapeHtml(symbol)} ${icon('external')}</a>`).join('')}</div></details>`;
}
function quotePanel(){
  const rows=followedQuoteRows(),free=useFreeQuotes(rows);
  const native=`${quoteError?`<p class="form-error" role="alert">${escapeHtml(quoteError)} · หากมีราคาจะแสดงค่าครั้งก่อน</p>`:''}<div class="table-wrap"><table><thead><tr><th>บริษัท</th><th>ราคา USD</th><th>เวลาและสถานะ</th></tr></thead><tbody>${rows.map(({symbol,item})=>`<tr><td><b>${escapeHtml(symbol)}</b><small>${escapeHtml(stock(symbol).name)}</small></td><td>${item?.quote?'$'+money(item.quote.price):'—'}</td><td>${item?.quote?`เวลาราคา ${escapeHtml(dateLabel(item.quote.quoteAt))}<small>ดึงเมื่อ ${escapeHtml(dateLabel(item.quote.fetchedAt))} · ${escapeHtml(item.quote.provider||'Finnhub')}</small>`:quoteBusy?'กำลังโหลดราคา…':'ยังไม่มีราคา'}<small>${escapeHtml(item?.error||'')}${quoteError||item?.stale?' · ข้อมูลเก่าหรือยังไม่พร้อม':''}${item?.olderPrice?' · อาจเป็นช่วงตลาดปิดหรือข้อมูลล่าช้า':''}</small></td></tr>`).join('')}</tbody></table></div>${quoteData.configured===true&&rows.some(({item})=>!item?.quote)?'<button class="text-button" type="button" data-free-quotes>เปิดตารางราคาฟรีจาก TradingView</button>':''}`;
  return `<section id="quotes-panel" class="card" data-mode="${free?'widget':'native'}" ${free?`data-widget-key="${escapeHtml(quoteWidgetKey())}"`:''} style="margin-top:20px"><div class="section-title"><h2>ราคาของบริษัทที่ติดตาม · USD</h2><button class="btn" type="button" data-refresh-quotes ${quoteBusy||!rows.length?'disabled':''}>${quoteBusy?'กำลังดึงราคา…':'อัปเดตราคา'}</button></div>${!rows.length?'<p class="empty">เลือกบริษัทที่สนใจเพื่อดูราคาและข่าว</p>':free?freeQuoteTable(rows):native}<p class="small-note">ไม่คำนวณมูลค่าพอร์ตหรือกำไรขาดทุน เพราะระบบไม่เก็บจำนวนหุ้นและต้นทุน</p></section>`;
}
document.addEventListener('click',event=>{
  if(!currentUser)return;
  if(event.target.closest('[data-free-quotes]')){quoteFreeSelected=true;updateQuotePanel();}
  if(event.target.closest('[data-refresh-quotes]')&&!quoteBusy){quoteWidgetRevision++;loadQuotes();}
});
new MutationObserver(()=>{if(document.querySelector('#quotes-panel')?.dataset.mode==='widget')updateQuotePanel();}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
