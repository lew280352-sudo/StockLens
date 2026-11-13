let articleSelections={},articleSummaries={},articleErrors={},articleBusy=null;
function resetArticleUI(){articleSelections={};articleSummaries={};articleErrors={};articleBusy=null;}
function articleChoices(){return newsData.items.filter(item=>item.symbol===selectedStock&&item.bodySupported);}
function selectedArticle(){const items=articleChoices();return items.find(item=>item.id===articleSelections[selectedStock])||items[0];}
function renderArticleCard(){
  const items=articleChoices(),item=selectedArticle(),result=item&&articleSummaries[item.id],available=aiStatus.enabled&&aiStatus.available;
  return `<section class="card article-card" id="article-card" aria-labelledby="article-card-title"><div class="section-title"><h2 id="article-card-title">สรุปเนื้อหาบทความ</h2><span class="counter">${escapeHtml(selectedStock)}</span></div><p class="muted">อ่านเนื้อหาจากลิงก์ข่าวก่อนสรุป แยกจากการสรุปหัวข้อข่าวด้านบน</p>
    ${items.length?`<label class="field">เลือกบทความ<select id="article-select" ${articleBusy?'disabled':''}>${items.map(article=>`<option value="${escapeHtml(article.id)}" ${article.id===item.id?'selected':''}>${escapeHtml(article.source)} · ${escapeHtml(article.title)}</option>`).join('')}</select></label><p class="small-note"><a class="text-button" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">เปิดต้นฉบับของบทความนี้</a></p>
    ${result?`<div class="article-summary" aria-live="polite"><div class="section-title"><h3>${escapeHtml(result.title)}</h3><span class="counter">${result.article.coverage==='partial'?'อ่านบางส่วน':'อ่านเนื้อหาแล้ว'}</span></div><p>${escapeHtml(result.summary)}</p><p class="small-note">${escapeHtml(aiProviderLabel(result.provider))} · อ่านต้นฉบับเมื่อ ${escapeHtml(dateLabel(result.article.readAt))}${result.cached?' · ใช้ผลสรุปที่บันทึกไว้':''}</p>${result.article.coverage==='partial'?'<p class="info-box">บทความยาว จึงใช้เนื้อหาบางส่วนในการสรุป</p>':''}${aiList('ข้อเท็จจริงจากเนื้อหา',result.facts)}${aiList('ปัจจัยที่ควรตรวจต่อ',result.positiveFactors)}${aiList('ความเสี่ยง',result.risks)}${aiList('ข้อมูลที่ยังไม่พอ',result.unknowns)}<p class="article-citation"><a class="text-button" href="${escapeHtml(result.article.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(result.article.source)} · ${escapeHtml(result.article.title)}</a></p></div>`:''}
    ${articleErrors[item.id]?`<p class="form-error" role="alert">${escapeHtml(articleErrors[item.id])}</p>`:''}<button class="btn primary" data-article-summary ${!available||articleBusy||aiBusy||aiQuestionBusy?'disabled':''}>${articleBusy?'กำลังอ่านและสรุปเนื้อหา…':'อ่านและสรุปเนื้อหา'}</button>${!available?'<p class="small-note">บริการ AI ยังไม่พร้อมสรุปเนื้อหา คุณยังเปิดอ่านต้นฉบับได้</p>':''}`:`<p class="small-note" role="status">${newsLoading?'กำลังโหลดรายการข่าว…':'ยังไม่มีบทความที่อ่านเนื้อหาอัตโนมัติได้สำหรับบริษัทนี้'}</p><button class="text-button" data-refresh-news ${newsLoading?'disabled':''}>โหลดรายการข่าวใหม่</button>`}
    <p class="small-note article-source-note">รองรับบทความสาธารณะจาก Apple, Microsoft, NVIDIA และ Netflix ในรายการข่าว บางหน้าอาจปิดการอ่านอัตโนมัติ เนื้อหาที่อ่านได้จะถูกส่งไปยังผู้ให้บริการ AI ที่เลือก</p></section>`;
}
async function runArticleSummary(){
  const item=selectedArticle();if(!currentUser||!item||articleBusy||aiBusy||aiQuestionBusy||!aiStatus.available)return;
  const epoch=authEpoch,userId=currentUser.id;articleBusy=item.id;delete articleErrors[item.id];render();
  try{
    const result=await api('/api/ai/article',{method:'POST',body:{articleId:item.id},timeout:90000});
    if(!sameSession(epoch,userId))return;articleSummaries[item.id]=result;
  }catch(error){if(!sameSession(epoch,userId))return;if(error.status===401){showSignedOut('login');return;}articleErrors[item.id]=error.message;}
  finally{if(sameSession(epoch,userId)){articleBusy=null;if(page==='insights')render();}}
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||!currentUser||isSaving)return;
  if(button.hasAttribute('data-article-summary'))runArticleSummary();
  if(button.hasAttribute('data-read-article')){
    const item=newsData.items.find(item=>item.id===button.dataset.readArticle&&item.bodySupported);if(!item)return;
    selectedStock=item.symbol;articleSelections[item.symbol]=item.id;navigate('insights');
    $('#article-card')?.scrollIntoView({block:'start',behavior:'instant'});runArticleSummary();
  }
});
document.addEventListener('change',event=>{if(event.target.id==='article-select'){articleSelections[selectedStock]=event.target.value;render();$('#article-select')?.focus();}});
