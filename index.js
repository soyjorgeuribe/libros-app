const express = require("express");
const path = require("node:path");
const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function validarCamposLibro(body) {
    const errores = [];

    if (typeof body.titulo !== "string" || !body.titulo.trim()) {
        errores.push("El título es obligatorio");
    }

    if (typeof body.autor !== "string" || !body.autor.trim()) {
        errores.push("El autor es obligatorio");
    }

    const anioActual = new Date().getFullYear();
    if (
        !Number.isInteger(body.anio_publicacion) ||
        body.anio_publicacion < 1450 ||
        body.anio_publicacion > anioActual
    ) {
        errores.push(`El año de publicación debe ser un entero entre 1450 y ${anioActual}`);
    }

    if (typeof body.genero !== "string" || !body.genero.trim()) {
        errores.push("El género es obligatorio");
    }

    if (
        Object.hasOwn(body, "disponible") &&
        typeof body.disponible !== "boolean"
    ) {
        errores.push("El campo disponible debe ser verdadero o falso");
    }

    return errores;
}

function obtenerIdValido(valor) {
    const id = Number(valor);
    return Number.isInteger(id) && id > 0 ? id : null;
}

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/libros", async (req, res) => {
    try {
        const [libros] = await pool.query("SELECT * FROM libros");
        res.json(libros);
    } catch (error) {
        console.error("Error al obtener los libros:", error.message);
        res.status(500).json({ error: "Error al obtener los libros" });
    }
});

app.get("/libros/buscar", async (req, res) => {
    const genero = req.query.genero;

    if (typeof genero !== "string" || !genero.trim()) {
        return res.status(400).json({
            error: "El parámetro genero es obligatorio"
        });
    }

    try {
        const [libros] = await pool.query(
            "SELECT * FROM libros WHERE genero = ?",
            [genero.trim()]
        );
        res.json(libros);
    } catch (error) {
        console.error("Error al buscar libros por género:", error.message);
        res.status(500).json({ error: "Error al buscar libros" });
    }
});

app.get("/libros/disponibles", async (req, res) => {
    try {
        const [libros] = await pool.query(
            "SELECT * FROM libros WHERE disponible = TRUE"
        );
        res.json(libros);
    } catch (error) {
        console.error("Error al obtener libros disponibles:", error.message);
        res.status(500).json({ error: "Error al obtener libros disponibles" });
    }
});

app.get("/libros/:id", async (req, res) => {
    const id = obtenerIdValido(req.params.id);
    if (id === null) {
        return res.status(404).json({ error: "Libro no encontrado" });
    }

    try {
        const [libros] = await pool.query(
            "SELECT * FROM libros WHERE id = ?",
            [id]
        );

        if (libros.length === 0) {
            return res.status(404).json({ error: "Libro no encontrado" });
        }

        res.json(libros[0]);
    } catch (error) {
        console.error("Error al obtener el libro:", error.message);
        res.status(500).json({ error: "Error al obtener el libro" });
    }
});

app.post("/libros", async (req, res) => {
    const body = req.body ?? {};
    const errores = validarCamposLibro(body);

    if (errores.length > 0) {
        return res.status(400).json({ error: errores.join("; ") });
    }

    const valores = [
        body.titulo.trim(),
        body.autor.trim(),
        body.anio_publicacion,
        body.genero.trim()
    ];
    const columnas = "titulo, autor, anio_publicacion, genero";
    const marcadores = "?, ?, ?, ?";

    if (Object.hasOwn(body, "disponible")) {
        valores.push(body.disponible);
    }

    try {
        const [resultado] = await pool.query(
            `INSERT INTO libros (${columnas}${Object.hasOwn(body, "disponible") ? ", disponible" : ""}) ` +
            `VALUES (${marcadores}${Object.hasOwn(body, "disponible") ? ", ?" : ""})`,
            valores
        );

        const [libros] = await pool.query(
            "SELECT * FROM libros WHERE id = ?",
            [resultado.insertId]
        );
        res.status(201).json(libros[0]);
    } catch (error) {
        console.error("Error al crear el libro:", error.message);
        res.status(500).json({ error: "Error al crear el libro" });
    }
});

app.put("/libros/:id", async (req, res) => {
    const id = obtenerIdValido(req.params.id);
    if (id === null) {
        return res.status(404).json({ error: "Libro no encontrado" });
    }

    const body = req.body ?? {};
    const errores = validarCamposLibro(body);
    if (errores.length > 0) {
        return res.status(400).json({ error: errores.join("; ") });
    }

    try {
        const [existentes] = await pool.query(
            "SELECT * FROM libros WHERE id = ?",
            [id]
        );

        if (existentes.length === 0) {
            return res.status(404).json({ error: "Libro no encontrado" });
        }

        const disponible = Object.hasOwn(body, "disponible")
            ? body.disponible
            : existentes[0].disponible;

        await pool.query(
            "UPDATE libros SET titulo = ?, autor = ?, anio_publicacion = ?, genero = ?, disponible = ? WHERE id = ?",
            [
                body.titulo.trim(),
                body.autor.trim(),
                body.anio_publicacion,
                body.genero.trim(),
                disponible,
                id
            ]
        );

        const [libros] = await pool.query(
            "SELECT * FROM libros WHERE id = ?",
            [id]
        );
        res.json(libros[0]);
    } catch (error) {
        console.error("Error al actualizar el libro:", error.message);
        res.status(500).json({ error: "Error al actualizar el libro" });
    }
});

app.patch("/libros/:id/disponible", async (req, res) => {
    const id = obtenerIdValido(req.params.id);
    if (id === null) {
        return res.status(404).json({ error: "Libro no encontrado" });
    }

    const disponible = req.body?.disponible;
    if (typeof disponible !== "boolean") {
        return res.status(400).json({
            error: "El campo disponible debe ser verdadero o falso"
        });
    }

    try {
        const [resultado] = await pool.query(
            "UPDATE libros SET disponible = ? WHERE id = ?",
            [disponible, id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: "Libro no encontrado" });
        }

        const [libros] = await pool.query(
            "SELECT * FROM libros WHERE id = ?",
            [id]
        );
        res.json(libros[0]);
    } catch (error) {
        console.error("Error al cambiar la disponibilidad del libro:", error.message);
        res.status(500).json({ error: "Error al cambiar la disponibilidad" });
    }
});

app.delete("/libros/:id", async (req, res) => {
    const id = obtenerIdValido(req.params.id);
    if (id === null) {
        return res.status(404).json({ error: "Libro no encontrado" });
    }

    try {
        const [resultado] = await pool.query(
            "DELETE FROM libros WHERE id = ?",
            [id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: "Libro no encontrado" });
        }

        res.status(204).send();
    } catch (error) {
        console.error("Error al eliminar el libro:", error.message);
        res.status(500).json({ error: "Error al eliminar el libro" });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
