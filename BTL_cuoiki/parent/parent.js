window.parentReady = Promise.all([window.dataReady, window.layoutReady]).then(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let signedInParent = null;
 try {
   const session = JSON.parse(sessionStorage.getItem('learnova.auth.session.v1') || 'null');
   if (session?.role === 'parent') signedInParent = session.id;
 } catch (_) {}
 const parent = DB.parents.find(p => p.id === (signedInParent || PAGE.parentId));
 if (!parent) throw new Error('Không tìm thấy phụ huynh demo.');
 const children = DB.students.filter(s => parent.childIds.includes(s.id) && s.parentId === parent.id);
 const params = new URLSearchParams(location.search);
 const child = children.find(s => s.id === params.get('child')) || children[0];
 $('parent-name').textContent = 'Theo dõi học tập của con';
 children.forEach(s => $('child').add(new Option(s.fullName, s.id)));
 if (!child) { $('child-info').textContent = 'Chưa liên kết học sinh.'; $('child').disabled = true; return null; }
 $('child').value = child.id;
 $('child').onchange = () => { const url = new URL(location.href); url.searchParams.set('child', $('child').value); url.searchParams.delete('id'); if (url.pathname.includes('result-detail')) url.pathname = url.pathname.replace('result-detail/result-detail.html','assignments/assignments.html'); location.href = url; };
 const cls = DB.classes.find(c => c.id === child.classId);
 $('child-info').textContent = child.fullName + ' · ' + (cls?.name || 'Chưa có lớp') + ' · ' + DB.meta.schoolYear;
 const home = '../assignments/assignments.html?child=' + encodeURIComponent(child.id);
 document.querySelectorAll('.sidebar a, #breadcrumb a').forEach(a => { if (a.closest('#breadcrumb')) a.href = home; else { const u = new URL(a.href); u.searchParams.set('child',child.id); a.href=u; } });
 const assignments = DB.assignments.filter(a => a.published && Store.targetsOf(a).some(s => s.id === child.id));
 const submissions = DB.submissions.filter(s => s.studentId === child.id && assignments.some(a => a.id === s.assignmentId));
 const sub = a => submissions.filter(s => s.assignmentId === a.id).sort((a,b) => Date.parse(b.submittedAt)-Date.parse(a.submittedAt))[0];
 const scoreVisible = (a,s) => !!s && s.status === 'graded' && Number.isFinite(s.score10) && (a.viewPolicy?.score === 'after_submit' || (a.viewPolicy?.score === 'after_grading') || (a.viewPolicy?.score === 'after_due' && Store.phaseOf(a) === 'closed'));
 const score = (a,s) => scoreVisible(a,s) ? s.score10.toFixed(1) : '—';
 const date = v => Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleString('vi-VN') : '—';
 const link = (page,id) => '../'+page+'/'+page+'.html?child='+encodeURIComponent(child.id)+(id ? '&id='+encodeURIComponent(id) : '');
 const labels = {graded:'Đã chấm',submitted:'Chờ chấm',ongoing:'Đang mở',upcoming:'Sắp diễn ra',closed:'Chưa nộp · hết hạn'};
 const statIcons = [
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3H5v18h14V3h-4M9 3v4h6V3zM8 12h8M8 16h5"/></svg>',
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 3 6 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1z"/></svg>',
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
 ];
 return {$,esc,parent,child,cls,assignments,submissions,sub,score,scoreVisible,date,link,labels,statIcons};
});
