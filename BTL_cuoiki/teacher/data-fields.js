/* Các bộ chọn lấy dữ liệu từ CSV trên trang phân tích và tạo bài. */
window.pageReady = Promise.all([window.dataReady, window.layoutReady]).then(function () {
  "use strict";
  function fill(select, placeholder, records, label) {
    const selected = select.value;
    select.replaceChildren(new Option(placeholder, ""));
    records.forEach(record => select.add(new Option(label(record), record.id)));
    if (records.some(record => record.id === selected)) select.value = selected;
  }

  const classFilter = document.getElementById("filter-class");
  if (classFilter) {
    const studentFilter = document.getElementById("filter-student");
    const testFilter = document.getElementById("filter-test");
    fill(classFilter, "Tất cả lớp", DB.classes, item => item.name);
    function updateStudents() {
      fill(studentFilter, "Tất cả học sinh",
        DB.students.filter(item => !classFilter.value || item.classId === classFilter.value),
        item => item.fullName);
    }
    function updateTests() {
      const records = DB.assignments.filter(item => {
        const targets = Store.targetsOf(item);
        return (!classFilter.value || targets.some(student => student.classId === classFilter.value))
          && (!studentFilter.value || targets.some(student => student.id === studentFilter.value));
      });
      fill(testFilter, "Tất cả bài", records, item => item.title);
    }
    classFilter.addEventListener("change", () => { updateStudents(); updateTests(); });
    studentFilter.addEventListener("change", updateTests);
    const reset = document.querySelector(".analytics-actions button[type=reset]");
    reset.addEventListener("click", () => {
      classFilter.value = "";
      studentFilter.value = "";
      testFilter.value = "";
      document.getElementById("filter-time").selectedIndex = 0;
      updateStudents();
      updateTests();
    });
    updateStudents();
    updateTests();
  }

  const classroom = document.getElementById("classroom");
  if (classroom) {
    fill(classroom, "Chọn lớp", DB.classes.filter(item => item.status === "active"),
      item => item.subject + " " + item.name);
    const topic = document.getElementById("topic");
    const suggestions = document.createElement("datalist");
    suggestions.id = "topic-options";
    topic.setAttribute("list", suggestions.id);
    topic.after(suggestions);
    function updateTopics() {
      const selectedClass = DB.classes.find(item => item.id === classroom.value);
      suggestions.replaceChildren();
      DB.topics.filter(item => !selectedClass || !item.grade || item.grade === selectedClass.grade)
        .forEach(item => suggestions.append(new Option(item.name, item.name)));
    }
    classroom.addEventListener("change", updateTopics);
    updateTopics();
  }
}).catch(window.reportDataError);
