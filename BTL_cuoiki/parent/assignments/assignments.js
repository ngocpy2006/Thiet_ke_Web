window.pageReady = parentReady.then(ctx => {
 if (!ctx) return; const {$,esc,assignments,sub,score,date,link,labels,cls} = ctx; let page=1; const size=8;
 const fold = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\u0111/g,'d').toLowerCase();
 function render(){
 const list=assignments.filter(a => fold(a.title).includes(fold($('query').value.trim())) && (!$('type').value || a.type===$('type').value) && (!$('status').value || (sub(a)?.status || Store.phaseOf(a))===$('status').value)).sort((a,b)=>Date.parse(b.dueAt)-Date.parse(a.dueAt));
 const pages=Math.max(1,Math.ceil(list.length/size)); page=Math.min(page,pages);
 $('rows').innerHTML=list.slice((page-1)*size,page*size).map(a=>{const s=sub(a);return '<tr><td>'+esc(a.title)+'<br><small>'+ (a.type==='kiem_tra'?'Bài kiểm tra':'Bài tập')+'</small></td><td>'+esc(a.subject)+' / '+esc(cls?.name)+'</td><td>'+date(a.dueAt)+'</td><td><span class="parent-status" data-status="'+esc(s?.status || Store.phaseOf(a))+'">'+esc(labels[s?.status || Store.phaseOf(a)])+'</span></td><td>'+score(a,s)+'</td><td>'+(s?'<a href="'+link('result-detail',s.id)+'">Xem bài làm</a>':'Chưa có bài làm')+'</td></tr>';}).join('') || '<tr><td colspan="6" class="parent-empty">Không có bài phù hợp.</td></tr>';
 $('summary').textContent=list.length+' bài phù hợp';$('page').textContent='Trang '+page+' / '+pages;$('prev').disabled=page===1;$('next').disabled=page===pages;
 }
 ['query','type','status'].forEach(id=>$(id).addEventListener(id==='query'?'input':'change',()=>{page=1;render();}));$('prev').onclick=()=>{page--;render();};$('next').onclick=()=>{page++;render();};render();
}).catch(window.reportDataError);
