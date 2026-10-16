window.pageReady = parentReady.then(ctx => {
 if(!ctx)return;const {$,esc,assignments,submissions,scoreVisible,date,link}=ctx;
 function render(){
 const from=$('from').value,to=$('to').value;
 $('range-error').textContent=from&&to&&from>to?'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.':'';
 const list=submissions.filter(s=>{const d=new Date(s.submittedAt);const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');return (!from||key>=from)&&(!to||key<=to)&&!(from&&to&&from>to);}).sort((a,b)=>Date.parse(a.submittedAt)-Date.parse(b.submittedAt));
 const graded=list.filter(s=>scoreVisible(assignments.find(a=>a.id===s.assignmentId),s));
 const avg=graded.length?(graded.reduce((n,s)=>n+s.score10,0)/graded.length).toFixed(1):'—';
 const duration=list.filter(s=>Number.isFinite(s.durationSec));
 $('stats').innerHTML=[['Bài đã nộp trong kỳ',list.length],['Điểm trung bình / 10',avg],['Bài có điểm công bố',graded.length],['Thời gian làm trung bình',duration.length?Math.round(duration.reduce((n,s)=>n+s.durationSec,0)/duration.length/60)+' phút':'—']].map(([label,value],index)=>'<div class="stat static"><span class="tile '+['blue','purple','green','red'][index]+'">'+ctx.statIcons[index]+'</span><div class="stat-body"><div class="stat-label">'+label+'</div><div class="stat-value">'+value+'</div></div></div>').join('');
 $('timeline').innerHTML=graded.map(s=>{const a=assignments.find(a=>a.id===s.assignmentId);return '<div class="parent-topic"><a href="'+link('result-detail',s.id)+'">'+esc(a.title)+'</a><p>'+date(s.submittedAt)+' · '+s.score10.toFixed(1)+'/10</p><div class="parent-meter"><span style="width:'+Math.max(0,Math.min(100,s.score10*10))+'%"></span></div></div>';}).join('')||'<p class="parent-empty">Chưa có điểm được công bố trong kỳ.</p>';
 const stats=Store.topicStats(graded);
 $('topics').innerHTML=stats.map(t=>'<div class="parent-topic"><strong>'+esc(DB.topics.find(x=>x.id===t.topicId)?.name||t.topicId)+'</strong><p>'+t.correct+'/'+t.total+' câu đúng · '+Math.round(t.rate*100)+'%</p><div class="parent-meter"><span style="width:'+Math.round(t.rate*100)+'%"></span></div><small>'+(!t.enough?'Chưa đủ dữ liệu để kết luận':t.weak?'Cần củng cố':'Tiếp tục phát huy')+'</small></div>').join('')||'<p class="parent-empty">Chưa đủ dữ liệu phân tích chủ đề.</p>';
 const weak=stats.filter(t=>t.weak);
 $('advice').textContent=!graded.length?'Chờ giáo viên công bố điểm để xem gợi ý học tập.':weak.length?'Cùng con ôn lại '+weak.map(t=>DB.topics.find(x=>x.id===t.topicId)?.name||t.topicId).join(', ')+', xem lại các câu trả lời sai và trao đổi với giáo viên.':stats.some(t=>!t.enough)?'Một số chủ đề còn ít dữ liệu. Khuyến khích con hoàn thành thêm bài để đánh giá chính xác hơn.':'Duy trì lịch học đều đặn và cùng con xem lại các bài đã làm.';
 }
 $('from').onchange=render;$('to').onchange=render;render();
}).catch(window.reportDataError);
