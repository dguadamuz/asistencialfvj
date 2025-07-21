// 🔹 Definir Supabase en el ámbito global
const supabaseUrl = 'https://qqcxntabmbnekeankpld.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxY3hudGFibWJuZWtlYW5rcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEzMTMxNjEsImV4cCI6MjA1Njg4OTE2MX0.uABYRadXhPLsUjTIEiEnqxvOLbkA0SJBSERx2pHZ4NE';

// Crear el cliente Supabase antes de usarlo
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM listo");

    // Asignar eventos a botones y selects
    document.getElementById('login-button').addEventListener('click', login);
    document.getElementById('group-select').addEventListener('change', loadStudents);
    document.getElementById('month-select').addEventListener('change', loadStudents);
    document.getElementById('subject-select').addEventListener('change', loadStudents);
    document.getElementById('save-absences-button').addEventListener('click', saveAbsences);
    document.getElementById('generate-pdf').addEventListener('click', generatePDF);

    // Inicialmente ocultar main-content y botón PDF
    document.getElementById('main-content').style.display = 'none';
    document.getElementById('generate-pdf').style.display = 'none';

    // Función de inicio de sesión
    async function login() {
        console.log("Iniciando el login");
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            console.error("Error de login:", error);
            alert("Credenciales incorrectas");
        } else {
            console.log("Login exitoso:", data);
            document.getElementById('login').style.display = 'none';
            document.getElementById('main-content').style.display = 'block';
            await loadGroups();

            // Mostrar botón PDF solo si es admin
            if (data.user.email === 'admin@lfvj.com') {
                document.getElementById('generate-pdf').style.display = 'block';
            } else {
                document.getElementById('generate-pdf').style.display = 'none';
            }
        }
    }
});  // fin DOMContentLoaded

// 🔹 Cargar grupos en el select
async function loadGroups() {
    console.log("Cargando grupos...");
    const { data, error } = await supabase.from('groups').select('*').order('name', { ascending: true });

    if (error) {
        console.error('Error al cargar los grupos:', error);
        return;
    }

    console.log("Grupos cargados:", data);

    const groupSelect = document.getElementById('group-select');
    groupSelect.innerHTML = '<option value="">Selecciona un grupo</option>';

    data.forEach(group => {
        const option = document.createElement('option');
        option.value = group.id;
        option.text = group.name;
        groupSelect.appendChild(option);
    });
}

// 🔹 Cargar estudiantes y ausencias para grupo, mes y materia seleccionados
async function loadStudents() {
    const groupId = document.getElementById('group-select').value;
    const month = document.getElementById('month-select').value;
    const subject = document.getElementById('subject-select').value;

    console.log(`loadStudents() llamado con groupId=${groupId}, month=${month}, subject=${subject}`);

    if (!groupId) {
        alert("Por favor, selecciona un grupo.");
        return;
    }
    if (!month) {
        alert("Por favor, selecciona un mes.");
        return;
    }
    if (!subject) {
        alert("Por favor, selecciona una materia.");
        return;
    }

    // Obtener nombre del grupo
    const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .single();

    if (groupError || !groupData) {
        console.error('Error al obtener el grupo:', groupError);
        return;
    }
    const groupName = groupData.name;
    console.log(`Grupo seleccionado: ${groupName}`);

    // Obtener estudiantes del grupo ordenados por apellidos y nombre
    const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, primer_apellido, segundo_apellido, nombre')
        .eq('grupo', groupName)
        .order('primer_apellido', { ascending: true })
        .order('segundo_apellido', { ascending: true })
        .order('nombre', { ascending: true });

    if (studentsError) {
        console.error('Error al cargar los estudiantes:', studentsError);
        return;
    }

    console.log(`Estudiantes encontrados (${students.length}):`, students);

    const tbody = document.getElementById('students-table').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';

    if (!students || students.length === 0) {
        console.log('No hay estudiantes en este grupo.');
        return;
    }

    // Obtener ausencias para mes y materia
    const { data: absences, error: absencesError } = await supabase
        .from('student_absences')
        .select('student_id, absence_count')
        .eq('month', month)
        .eq('subject', subject);

    if (absencesError) {
        console.error('Error al cargar ausencias:', absencesError);
        return;
    }

    console.log(`Ausencias cargadas (${absences.length}):`, absences);

    // Mostrar estudiantes y input de ausencias
    students.forEach(student => {
        const absenceRecord = absences.find(a => a.student_id === student.id);
        const absenceCount = absenceRecord ? absenceRecord.absence_count : 0;

        const row = tbody.insertRow();
        row.insertCell(0).textContent = `${student.primer_apellido} ${student.segundo_apellido} ${student.nombre}`;

        const absenceCell = row.insertCell(1);
        const absenceInput = document.createElement('input');
        absenceInput.type = 'number';
        absenceInput.min = 0;
        absenceInput.value = absenceCount;
        absenceInput.dataset.studentId = student.id;
        absenceCell.appendChild(absenceInput);
    });
}

// 🔹 Guardar ausencias con upsert
async function saveAbsences() {
    const month = document.getElementById('month-select').value;
    const subject = document.getElementById('subject-select').value;

    console.log(`Guardando ausencias para month=${month}, subject=${subject}`);

    if (!month) {
        alert("Por favor, selecciona un mes.");
        return;
    }
    if (!subject) {
        alert("Por favor, selecciona una materia.");
        return;
    }

    const inputs = document.querySelectorAll('#students-table tbody input');

    const absenceRecords = Array.from(inputs).map(input => ({
        student_id: input.dataset.studentId,
        absence_count: parseInt(input.value, 10) || 0,
        month: month,
        subject: subject
    }));

    console.log("Registros a guardar:", absenceRecords);

    const { error } = await supabase
        .from('student_absences')
        .upsert(absenceRecords, {
            onConflict: ['student_id', 'subject', 'month']
        });

    if (error) {
        console.error('Error al guardar las ausencias:', error);
        alert('No se pudo guardar la información.');
    } else {
        alert('Ausencias guardadas correctamente.');
    }
}

// 🔹 Generar PDF con tabla de ausencias bien formateada
document.getElementById('generate-pdf').addEventListener('click', generatePDF);

async function generatePDF() {
  const { jsPDF } = window.jspdf;

  const groupId = document.getElementById('group-select').value;
  if (!groupId) {
    alert("Selecciona un grupo antes de generar el PDF.");
    return;
  }

  // Obtener nombre del grupo
  const { data: groupData, error: groupError } = await supabase
    .from('groups')
    .select('name')
    .eq('id', groupId)
    .single();

  if (groupError || !groupData) {
    alert("No se pudo obtener el nombre del grupo.");
    return;
  }

  const groupName = groupData.name;

  // Obtener estudiantes del grupo
  const { data: studentsData, error: studentsError } = await supabase
    .from('students')
    .select('id, primer_apellido, segundo_apellido, nombre')
    .eq('grupo', groupName)
    .order('primer_apellido', { ascending: true });

  if (studentsError || !studentsData) {
    alert("Error al cargar los estudiantes.");
    return;
  }

  const months = ['Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'];

  for (const student of studentsData) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

    const nombreCompleto = `${student.primer_apellido} ${student.segundo_apellido} ${student.nombre}`;

    // Título
    doc.setFontSize(14);
    doc.text("Informe de Ausencias", 105, 15, { align: "center" });

    // Encabezado
    doc.setFontSize(10);
    doc.text(`Estudiante: ${nombreCompleto}`, 14, 25);
    doc.text(`Grupo: ${groupName}`, 14, 32);

    // Obtener ausencias por estudiante
    const { data: absencesData, error: absencesError } = await supabase
      .from('student_absences')
      .select('month, absence_count, subject')
      .eq('student_id', student.id);

    if (absencesError) {
      console.error("Error al obtener ausencias:", absencesError);
      alert(error.message);
      continue;
    }

    const subjects = [...new Set(absencesData.map(a => a.subject))].sort();

    // Formato de tabla
    const startX = 14;
    const startY = 44;
    const rowHeight = 8;
    const colWidths = [50, 20, 20, 20, 20, 20];
    let y = startY;

    // Encabezado tabla
    let x = startX;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    doc.rect(x, y, colWidths[0], rowHeight);
    doc.text("Asignatura", x + 2, y + 6);
    x += colWidths[0];

    for (let i = 0; i < months.length; i++) {
      doc.rect(x, y, colWidths[i + 1], rowHeight);
      doc.text(months[i], x + 2, y + 6);
      x += colWidths[i + 1];
    }

    y += rowHeight;
    doc.setFont("helvetica", "normal");

    // Normalizador de textos
    const normalize = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    // Filas de asignaturas
    for (const subject of subjects) {
      x = startX;
      doc.rect(x, y, colWidths[0], rowHeight);
      doc.text(subject, x + 2, y + 6);
      x += colWidths[0];

      for (let i = 0; i < months.length; i++) {
        const month = months[i];
        const absence = absencesData.find(a =>
          normalize(a.subject) === normalize(subject) &&
          normalize(a.month) === normalize(month)
        );

        const count = absence ? absence.absence_count.toString() : "0";

        doc.rect(x, y, colWidths[i + 1], rowHeight);
        doc.text(count, x + colWidths[i + 1] / 2, y + 6, { align: "center" });
        x += colWidths[i + 1];
      }

      y += rowHeight;

      // Agregar nueva página si se sale del margen
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    }

    const filename = `${nombreCompleto.replace(/ /g, '_')}_Ausencias.pdf`;
    doc.save(filename);
  }

  alert("PDFs generados para todos los estudiantes.");
}
