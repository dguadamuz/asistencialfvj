// Primero, define el puerto
const PORT = process.env.PORT || 4000;

// Luego, importa las dependencias
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const app = express();

// Configuración de Supabase (deberás poner tus credenciales aquí)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qqcxntabmbnekeankpld.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxY3hudGFibWJuZWtlYW5rcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEzMTMxNjEsImV4cCI6MjA1Njg4OTE2MX0.uABYRadXhPLsUjTIEiEnqxvOLbkA0SJBSERx2pHZ4NE';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Middleware para poder recibir JSON en las solicitudes
app.use(express.json());

// Ruta de prueba para la raíz
app.get('/', (req, res) => {
  res.send('¡Servidor funcionando correctamente!');
});

// Ruta POST para la API de asistencia
app.post('/asistencia', async (req, res) => {
  const { usuario_id, fecha, estado } = req.body;

  if (!usuario_id || !fecha || !estado) {
    return res.status(400).send('Faltan datos en la solicitud.');
  }

  try {
    // Insertar los datos en la tabla de asistencia en Supabase
    const { data, error } = await supabase
      .from('asistencia')
      .insert([{ usuario_id, fecha, estado }]);

    if (error) {
      throw error;
    }

    // Enviar respuesta de éxito
    res.status(201).send({ message: 'Asistencia registrada correctamente', data });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }

});
app.get('/asistencia', async (req, res) => {
    try {
        const { data, error } = await supabase.from('asistencia').select('*');

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});


// Iniciar el servidor en el puerto definido
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
