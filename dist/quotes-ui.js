let quoteData={configured:null,items:[]},quoteBusy=false,quoteError='',quoteEpoch=0,quoteReload=false,quoteFreeSelected=false,quoteWidgetRevision=0,quoteComparisonOpen=false,quoteComparisonPeriod='1d',quoteComparisonSymbol='';
function resetQuotes(){quoteEpoch++;quoteBusy=false;quoteReload=false;quoteFreeSelected=false;quoteWidgetRevision=0;quoteComparisonOpen=false;quoteComparisonPeriod='1d';quoteComparisonSymbol='';quoteData={configured:null,items:[]};quoteError='';}
function followedQuoteRows(){return state.watchlist.filter(symbol=>stocks.some(company=>company.symbol===symbol)).map(symbol=>({symbol,item:quoteData.items.find(item=>item.symbol===symbol)}));}
function useFreeQuotes(rows=followedQuoteRows()){
  return rows.length>0&&(quoteFreeSelected||quoteData.configured===false||((quoteError||quoteData.items.length>0)&&rows.every(({item})=>!item?.quote)));
}
const quoteComparisonRanges={
  '1d':{label:'เมื่อวาน',range:'1d|1'},'1w':{label:'1 สัปดาห์',range:'1w|15'},'1m':{label:'1 เดือน',range:'1m|30'},
  '3m':{label:'3 เดือน',range:'3m|60'},'6m':{label:'6 เดือน',range:'6m|120'},'1y':{label:'1 ปี',range:'12m|1D'}
};
function comparisonSymbol(rows){return rows.some(row=>row.symbol===quoteComparisonSymbol)?quoteComparisonSymbol:rows[0]?.symbol||'';}
function quotePanelKey(rows=followedQuoteRows()){return JSON.stringify([rows,quoteData.configured,quoteError,document.documentElement.dataset.theme,quoteWidgetRevision,quoteFreeSelected,quoteComparisonOpen,comparisonSymbol(rows),quoteComparisonPeriod]);}
function updateQuotePanel(){
  const panel=document.querySelector('#quotes-panel');if(!panel||!currentUser)return;
  // Keep an existing provider connection while the optional API check finishes.
  if(panel.dataset.renderKey===quotePanelKey()){
    const button=panel.querySelector('[data-refresh-quotes]');button.disabled=quoteBusy||!state.watchlist.length;button.textContent=quoteBusy?'กำลังดึงราคา…':'อัปเดตราคา';return;
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
function quoteDayChange(quote){
  if(!quote||![quote.previousClose,quote.change,quote.changePercent].every(value=>typeof value==='number'&&Number.isFinite(value))||quote.previousClose<=0)return '';
  const signed=value=>(value>0?'+':value<0?'−':'')+money(Math.abs(value));
  const direction=quote.change>0?'positive':quote.change<0?'negative':'neutral';
  return `<small class="quote-day-change ${direction}">${quote.change>0?'+':quote.change<0?'−':''}$${money(Math.abs(quote.change))}<br>${signed(quote.changePercent)}%</small><small class="quote-previous-close">เทียบปิดก่อน $${money(quote.previousClose)}</small>`;
}
function renderQuoteComparison(rows){
  const selected=comparisonSymbol(rows);
  const period=quoteComparisonRanges[quoteComparisonPeriod],theme=document.documentElement.dataset.theme==='light'?'light':'dark';
  const settings={symbols:[[stock(selected).name,selected+'|1D']],width:'100%',height:'100%',colorTheme:theme,backgroundColor:theme==='light'?'#ffffff':'#211b2c',chartOnly:false,isTransparent:false,locale:'th',showVolume:false,showMA:false,hideDateRanges:true,hideMarketStatus:false,hideSymbolLogo:false,scalePosition:'right',scaleMode:'Normal',chartType:'area',lineWidth:2,changeMode:'price-and-percent',valuesTracking:'1',fontSize:'12',headerFontSize:'20',dateRanges:[period.range],dateFormat:'dd MMM yyyy',timeHoursFormat:'24-hours','page-uri':location.origin};
  const src='https://www.tradingview-widget.com/embed-widget/symbol-overview/?locale=th#'+encodeURIComponent(JSON.stringify(settings));
  return `<div class="quote-comparison-action"><button class="btn" type="button" data-toggle-quote-comparison aria-expanded="${quoteComparisonOpen}" aria-controls="quote-comparison">${icon('up')}${quoteComparisonOpen?'ปิดการเปรียบเทียบ':'เปรียบเทียบย้อนหลัง'}</button></div><section id="quote-comparison" class="quote-comparison" aria-labelledby="quote-comparison-heading" ${quoteComparisonOpen?'':'hidden'}>${quoteComparisonOpen?`<div class="quote-comparison-heading"><div><h3 id="quote-comparison-heading" tabindex="-1">เปรียบเทียบราคาย้อนหลัง</h3><p>ดูส่วนต่าง USD และ % ตามช่วงที่เลือก</p></div><label class="field">บริษัท<select id="quote-comparison-symbol">${rows.map(({symbol})=>`<option value="${escapeHtml(symbol)}" ${symbol===selected?'selected':''}>${escapeHtml(symbol)} · ${escapeHtml(stock(symbol).name)}</option>`).join('')}</select></label></div><div class="quote-periods" role="group" aria-label="ช่วงเวลาเปรียบเทียบราคา">${Object.entries(quoteComparisonRanges).map(([key,value])=>`<button type="button" class="btn ${key===quoteComparisonPeriod?'active':''}" data-quote-period="${key}" aria-pressed="${key===quoteComparisonPeriod}">${value.label}</button>`).join('')}</div><p class="quote-comparison-source">${escapeHtml(selected)} · ${period.label} · TradingView · ข้อมูลล่าช้าตามตลาด</p><div class="quote-comparison-chart"><iframe class="quote-comparison-widget" title="กราฟเปรียบเทียบราคา ${escapeHtml(selected)} ${period.label}" src="${escapeHtml(src)}" referrerpolicy="origin" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe></div><div class="tradingview-widget-copyright quote-attribution"><a href="https://www.tradingview.com/symbols/${encodeURIComponent(selected)}/" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(stock(selected).name)} stock price by TradingView</a></div><p class="small-note">เลือกช่วงแล้วดูส่วนต่างราคาและเปอร์เซ็นต์ด้านบนกราฟ แตะหรือชี้เส้นเพื่อดูราคาและวันที่ · “เมื่อวาน” หมายถึงเทียบราคาปิดวันซื้อขายก่อนหน้า · ช่วงวันหยุดใช้จุดราคาที่มีในกราฟ เวลาและข้อมูลในกราฟอ้างอิงตามผู้ให้บริการ</p><details class="quote-links"><summary>เปิดกราฟที่ผู้ให้บริการ หากกราฟไม่แสดง</summary><div><a href="https://www.tradingview.com/symbols/${encodeURIComponent(selected)}/" target="_blank" rel="noopener noreferrer">เปิดกราฟ ${escapeHtml(selected)} ${icon('external')}</a></div></details>`:''}</section>`;
}
function quotePanel(){
  const rows=followedQuoteRows(),free=useFreeQuotes(rows);
  const native=`${quoteError?`<p class="form-error" role="alert">${escapeHtml(quoteError)} · หากมีราคาจะแสดงค่าครั้งก่อน</p>`:''}<div class="table-wrap"><table><thead><tr><th>บริษัท</th><th>ราคา USD</th><th>เวลาและสถานะ</th></tr></thead><tbody>${rows.map(({symbol,item})=>`<tr><td><b>${escapeHtml(symbol)}</b><small>${escapeHtml(stock(symbol).name)}</small></td><td>${item?.quote?'$'+money(item.quote.price):'—'}${quoteDayChange(item?.quote)}</td><td>${item?.quote?`เวลาราคา ${escapeHtml(dateLabel(item.quote.quoteAt))}<small>ดึงเมื่อ ${escapeHtml(dateLabel(item.quote.fetchedAt))} · ${escapeHtml(item.quote.provider||'Finnhub')}</small>`:quoteBusy?'กำลังโหลดราคา…':'ยังไม่มีราคา'}<small>${escapeHtml(item?.error||'')}${quoteError||item?.stale?' · ข้อมูลเก่าหรือยังไม่พร้อม':''}${item?.olderPrice?' · อาจเป็นช่วงตลาดปิดหรือข้อมูลล่าช้า':''}</small></td></tr>`).join('')}</tbody></table></div>${quoteData.configured===true&&rows.some(({item})=>!item?.quote)?'<button class="text-button" type="button" data-free-quotes>เปิดตารางราคาฟรีจาก TradingView</button>':''}`;
  return `<section id="quotes-panel" class="card" data-mode="${free?'widget':'native'}" data-render-key="${escapeHtml(quotePanelKey(rows))}" style="margin-top:20px"><div class="section-title"><h2>ราคาของบริษัทที่ติดตาม · USD</h2><button class="btn" type="button" data-refresh-quotes ${quoteBusy||!rows.length?'disabled':''}>${quoteBusy?'กำลังดึงราคา…':'อัปเดตราคา'}</button></div>${!rows.length?'<p class="empty">เลือกบริษัทที่สนใจเพื่อดูราคาและข่าว</p>':(free?freeQuoteTable(rows):native)+renderQuoteComparison(rows)}<p class="small-note">ไม่คำนวณมูลค่าพอร์ตหรือกำไรขาดทุน เพราะระบบไม่เก็บจำนวนหุ้นและต้นทุน</p></section>`;
}
document.addEventListener('click',event=>{
  if(!currentUser)return;
  const period=event.target.closest('[data-quote-period]')?.dataset.quotePeriod;
  if(period&&Object.hasOwn(quoteComparisonRanges,period)){quoteComparisonPeriod=period;updateQuotePanel();document.querySelector(`[data-quote-period="${period}"]`)?.focus({preventScroll:true});}
  if(event.target.closest('[data-toggle-quote-comparison]')){quoteComparisonOpen=!quoteComparisonOpen;updateQuotePanel();if(quoteComparisonOpen){document.querySelector('#quote-comparison-heading')?.focus({preventScroll:true});document.querySelector('#quote-comparison')?.scrollIntoView({block:'start',behavior:'instant'});}else document.querySelector('[data-toggle-quote-comparison]')?.focus({preventScroll:true});}
  if(event.target.closest('[data-free-quotes]')){quoteFreeSelected=true;updateQuotePanel();}
  if(event.target.closest('[data-refresh-quotes]')&&!quoteBusy){quoteWidgetRevision++;loadQuotes();}
});
document.addEventListener('change',event=>{if(event.target.id!=='quote-comparison-symbol'||!currentUser||!state.watchlist.includes(event.target.value))return;quoteComparisonSymbol=event.target.value;updateQuotePanel();document.querySelector('#quote-comparison-symbol')?.focus({preventScroll:true});});
new MutationObserver(()=>{const panel=document.querySelector('#quotes-panel');if(panel&&(panel.dataset.mode==='widget'||quoteComparisonOpen))updateQuotePanel();}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
