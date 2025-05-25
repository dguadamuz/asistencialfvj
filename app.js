// 🔹 Definir Supabase en el ámbito global
const supabaseUrl = 'https://qqcxntabmbnekeankpld.supabase.co';  
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxY3hudGFibWJuZWtlYW5rcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEzMTMxNjEsImV4cCI6MjA1Njg4OTE2MX0.uABYRadXhPLsUjTIEiEnqxvOLbkA0SJBSERx2pHZ4NE';

// 🔹 Asegúrate de crear supabase **antes** de usarlo en cualquier parte del código
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Esperar a que el contenido del DOM se haya cargado completamente
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-button').addEventListener('click', login);
    document.getElementById('group-select').addEventListener('change', loadStudents);
    document.getElementById('month-select').addEventListener('change', loadStudents);
    document.getElementById('subject-select').addEventListener('change', loadStudents);
    document.getElementById('save-absences-button').addEventListener('click', saveAbsences);
    document.getElementById('generate-pdf').addEventListener('click', generatePDF);

    // 🔹 Función de inicio de sesión
    async function login() {
        console.log("Iniciando el login");  // Esto debería aparecer en la consola cuando se haga clic en el botón
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
    
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
        if (error) {
            console.error("Error de login:", error);  // Verificar si hay error
            alert("Credenciales incorrectas");
        } else {
            console.log("Login exitoso:", data);  // Verificar si el login fue exitoso
            document.getElementById('login').style.display = 'none';
            document.getElementById('main-content').style.display = 'block';
            loadGroups();
            
            // Verificamos si el correo es el del administrador
            if (data.user.email === 'admin@lfvj.com') {
                // Mostrar el botón de generar PDF solo si el usuario es admin
                document.getElementById('generate-pdf').style.display = 'block';
            } else {
                // Asegúrate de ocultarlo si no es admin
                document.getElementById('generate-pdf').style.display = 'none';
            }
        }
    }
});  // Cierre del DOMContentLoaded

// 🔹 Cargar grupos
async function loadGroups() {
    const { data, error } = await supabase.from('groups').select('*').order('name', { ascending: true });

    if (error) {
        console.error('Error al cargar los grupos:', error);
        return;
    }

    const groupSelect = document.getElementById('group-select');
    groupSelect.innerHTML = '<option value="">Selecciona un grupo</option>';

    data.forEach(group => {
        const option = document.createElement('option');
        option.value = group.id;
        option.text = group.name;
        groupSelect.appendChild(option);
    });
}

// 🔹 Cargar estudiantes y ausencias por grupo, mes y materia
async function loadStudents() {
    const groupId = document.getElementById('group-select').value;
    const month = document.getElementById('month-select').value;
    const subject = document.getElementById('subject-select').value;

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

    // Obtener estudiantes del grupo ordenados por apellido y nombre
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

    if (!students || students.length === 0) {
        console.log('No hay estudiantes en este grupo.');
        const tbodyEmpty = document.getElementById('students-table').getElementsByTagName('tbody')[0];
        tbodyEmpty.innerHTML = '';
        return;
    }

    // Obtener ausencias existentes para este mes y materia
    const { data: absences, error: absencesError } = await supabase
        .from('student_absences')
        .select('student_id, absence_count')
        .eq('month', month)
        .eq('subject', subject);

    if (absencesError) {
        console.error('Error al cargar ausencias:', absencesError);
        return;
    }

    const tbody = document.getElementById('students-table').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';

    students.forEach(student => {
        // Buscar ausencia para este estudiante
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

// 🔹 Guardar ausencias con upsert (insertar o actualizar)
async function saveAbsences() {
    const month = document.getElementById('month-select').value;
    const subject = document.getElementById('subject-select').value;

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
        absence_count: parseInt(input.value, 10),
        month: month,
        subject: subject
    }));

    const { data, error } = await supabase
        .from('student_absences')
        .upsert(absenceRecords, {
            onConflict: ['student_id', 'subject', 'month'] // 👈 Clave compuesta para evitar duplicados
        });

    if (error) {
        console.error('Error al guardar las ausencias:', error);
        alert('No se pudo guardar la información.');
    } else {
        alert('Ausencias guardadas correctamente.');
    }
}

// Generar PDF
const { jsPDF } = window.jspdf;

// 🔹 Generar un PDF para cada estudiante con un pequeño retraso entre cada uno
async function generatePDF() {
    console.log("🔹 Iniciando generación de PDFs...");

    // Obtener valores seleccionados
    const groupId = document.getElementById('group-select').value;
    const months = ['Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'];

    console.log("ID del grupo seleccionado:", groupId);

    // 🔹 Obtener el nombre del grupo desde Supabase
    const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .single();

    if (groupError) {
        console.error("❌ Error al obtener el grupo:", groupError);
        alert("No se pudo obtener el nombre del grupo.");
        return;
    }

    const groupName = groupData.name;
    console.log("Nombre del grupo:", groupName);

    // 🔹 Obtener todas las asignaturas desde Supabase
    const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('name');

    if (subjectsError) {
        console.error("❌ Error al obtener las asignaturas:", subjectsError);
        alert("Error al cargar las asignaturas.");
        return;
    }

    console.log("Asignaturas obtenidas:", subjectsData);

    // 🔹 Obtener los estudiantes del grupo usando el nombre del grupo
    const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, primer_apellido, segundo_apellido, nombre')
        .eq('grupo', groupName)
        .order('primer_apellido', { ascending: true })
        .order('segundo_apellido', { ascending: true })
        .order('nombre', { ascending: true });

    if (studentsError) {
        console.error("❌ Error al obtener los estudiantes:", studentsError);
        alert("Error al cargar los estudiantes.");
        return;
    }

    console.log("Estudiantes obtenidos:", studentsData);

    // 🔹 Recorrer cada estudiante y generar el PDF
    for (const student of studentsData) {
        const doc = new jsPDF();

        doc.setFontSize(16);
        doc.text('Informe de ausencias', 10, 10);
        doc.setFontSize(12);
        doc.text(`Estudiante: ${student.primer_apellido} ${student.segundo_apellido} ${student.nombre}`, 10, 20);
        doc.text(`Grupo: ${groupName}`, 10, 30);

        let y = 40;

        // 🔹 Consultar las ausencias para este estudiante, cada mes y cada asignatura
        for (const month of months) {
            doc.text(`Mes: ${month}`, 10, y);
            y += 10;

            for (const subject of subjectsData) {
                // Obtener ausencia del estudiante para este mes y materia
                const { data: absenceData, error: absenceError } = await supabase
                    .from('student_absences')
                    .select('absence_count')
                    .eq('student_id', student.id)
                    .eq('month', month)
                    .eq('subject', subject.name)
                    .single();

                if (absenceError) {
                    console.error(`Error al obtener ausencia para ${student.nombre} en ${month} y ${subject.name}:`, absenceError);
                    doc.text(`- ${subject.name}: Error al obtener datos`, 20, y);
                } else {
                    const absenceCount = absenceData ? absenceData.absence_count : 0;
                    doc.text(`- ${subject.name}: ${absenceCount}`, 20, y);
                }
                y += 10;
            }
        }

        // 🔹 Guardar PDF en disco (esto solo descarga en navegador)
        doc.save(`Ausencias_${student.primer_apellido}_${student.nombre}.pdf`);

        // 🔹 Pausa entre generación de PDFs para no saturar la memoria
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}
