/* Hiển thị hồ sơ đang dùng, cùng tài khoản với sidebar và topbar. */
Promise.all([window.dataReady, window.layoutReady]).then(function () {
  const app = window.APP;
  const people = app.role === 'student' ? DB.students : DB.teachers;
  const user = app.user && people.find(person => person.id === app.user.id);
  if (!user) return;
  document.getElementById('profile-display-name').textContent = user.fullName;
  document.querySelector('.profile-avatar').textContent = user.fullName.trim().split(/\s+/).slice(-2).map(word => word[0]).join('');
  const values = { name: user.fullName, birthday: user.birthday || user.dateOfBirth, phone: user.phone, email: user.email, address: user.address };
  Object.entries(values).forEach(([field, value]) => {
    document.getElementById('profile-' + field).value = value || '';
  });
  document.getElementById('profile-role').value = app.role === 'student' ? 'Hocsinh' : 'Giaovien';
}).catch(error => console.error('[account]', error));
