const formLibro = document.getElementById("formLibro");
const tablaLibros = document.getElementById("tablaLibros");
const campoId = document.getElementById("id");
const campoTitulo = document.getElementById("titulo");
const campoAutor = document.getElementById("autor");
const campoAnio = document.getElementById("anio");
const campoGenero = document.getElementById("genero");
const campoDisponible = document.getElementById("disponible");
const campoFiltroGenero = document.getElementById("filtroGenero");
const aviso = document.getElementById("aviso");
const estadoVacio = document.getElementById("estadoVacio");
const contadorLibros = document.getElementById("contadorLibros");
const botonGuardar = document.getElementById("btnGuardar");
const botonCancelar = document.getElementById("btnCancelar");
const botonTodos = document.getElementById("btnTodos");
const botonDisponibles = document.getElementById("btnDisponibles");

campoAnio.max = new Date().getFullYear();

let filtroActual = "todos";
let librosActuales = [];

async function solicitar(url, opciones = {}) {
    const respuesta = await fetch(url, opciones);
    if (!respuesta.ok) {
        let mensaje = "No se pudo completar la solicitud.";
        try {
            const resultado = await respuesta.json();
            mensaje = resultado.error || mensaje;
        } catch {
            // Algunas respuestas, como DELETE 204, no incluyen JSON.
        }
        throw new Error(mensaje);
    }
    return respuesta.status === 204 ? null : respuesta.json();
}

function mostrarAviso(mensaje, exito = false) {
    aviso.textContent = mensaje;
    aviso.classList.toggle("exito", exito);
    aviso.classList.remove("oculto");
}

function limpiarAviso() {
    aviso.textContent = "";
    aviso.classList.add("oculto");
    aviso.classList.remove("exito");
}

function actualizarContador(cantidad) {
    contadorLibros.textContent = `${cantidad} ${cantidad === 1 ? "libro" : "libros"}`;
}

async function cargarLibros() {
    limpiarAviso();
    let url = "/libros";
    if (filtroActual === "disponibles") {
        url = "/libros/disponibles";
    } else if (filtroActual === "genero") {
        url = `/libros/buscar?genero=${encodeURIComponent(campoFiltroGenero.value.trim())}`;
    }

    try {
        librosActuales = await solicitar(url);
        dibujarLibros(librosActuales);
    } catch (error) {
        librosActuales = [];
        dibujarLibros([]);
        mostrarAviso(`${error.message} Comprueba que MySQL esté iniciado y la base biblioteca exista.`);
    }
}

function crearCelda(contenido, clase) {
    const celda = document.createElement("td");
    if (clase) celda.className = clase;
    if (contenido instanceof Node) celda.appendChild(contenido);
    else celda.textContent = contenido;
    return celda;
}

function dibujarLibros(libros) {
    tablaLibros.replaceChildren();
    actualizarContador(libros.length);
    estadoVacio.classList.toggle("oculto", libros.length > 0);

    libros.forEach((libro) => {
        const fila = document.createElement("tr");
        const libroCelda = document.createElement("div");
        libroCelda.className = "celda-libro";

        const miniatura = document.createElement("span");
        miniatura.className = `miniatura-libro color-${Math.abs(Number(libro.id)) % 4}`;
        miniatura.setAttribute("aria-hidden", "true");
        miniatura.textContent = libro.titulo.trim().charAt(0).toUpperCase() || "L";

        const titulo = document.createElement("span");
        titulo.className = "nombre-libro";
        titulo.textContent = libro.titulo;
        libroCelda.append(miniatura, titulo);

        fila.append(
            crearCelda(libroCelda),
            crearCelda(libro.autor),
            crearCelda(libro.anio_publicacion),
            crearCelda(libro.genero)
        );

        const estado = document.createElement("span");
        const disponible = libro.disponible === true || libro.disponible === 1;
        estado.className = `estado ${disponible ? "estado-disponible" : "estado-no-disponible"}`;
        estado.textContent = disponible ? "Disponible" : "Prestado";
        fila.appendChild(crearCelda(estado));

        const acciones = document.createElement("div");
        acciones.className = "acciones";
        acciones.append(
            crearBoton("Editar", "boton-accion", () => editarLibro(libro)),
            crearBoton(
                disponible ? "Marcar prestado" : "Marcar disponible",
                "boton-accion",
                () => cambiarDisponibilidad(libro, !disponible)
            ),
            crearBoton("Eliminar", "boton-accion boton-eliminar", () => eliminarLibro(libro))
        );
        fila.appendChild(crearCelda(acciones));
        tablaLibros.appendChild(fila);
    });
}

function crearBoton(texto, clase, alHacerClick) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = clase;
    boton.textContent = texto;
    boton.addEventListener("click", alHacerClick);
    return boton;
}

formLibro.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarAviso();

    const anio = Number(campoAnio.value);
    const libro = {
        titulo: campoTitulo.value.trim(),
        autor: campoAutor.value.trim(),
        anio_publicacion: anio,
        genero: campoGenero.value.trim(),
        disponible: campoDisponible.checked
    };

    if (!libro.titulo || !libro.autor || !libro.genero || !Number.isInteger(anio) || anio < 1450 || anio > new Date().getFullYear()) {
        mostrarAviso(`Completa todos los campos. El año debe estar entre 1450 y ${new Date().getFullYear()}.`);
        return;
    }

    const id = campoId.value;
    try {
        await solicitar(id ? `/libros/${id}` : "/libros", {
            method: id ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(libro)
        });
        limpiarFormulario();
        await cargarLibros();
        mostrarAviso(id ? "Libro actualizado correctamente." : "Libro agregado a tu colección.", true);
    } catch (error) {
        mostrarAviso(error.message);
    }
});

function editarLibro(libro) {
    campoId.value = libro.id;
    campoTitulo.value = libro.titulo;
    campoAutor.value = libro.autor;
    campoAnio.value = libro.anio_publicacion;
    campoGenero.value = libro.genero;
    campoDisponible.checked = libro.disponible === true || libro.disponible === 1;
    document.getElementById("tituloFormulario").textContent = "Editar libro";
    botonGuardar.innerHTML = "<span aria-hidden=\"true\">✓</span> Guardar cambios";
    botonCancelar.classList.remove("oculto");
    formLibro.scrollIntoView({ behavior: "smooth", block: "center" });
    campoTitulo.focus({ preventScroll: true });
}

async function cambiarDisponibilidad(libro, disponible) {
    limpiarAviso();
    try {
        await solicitar(`/libros/${libro.id}/disponible`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ disponible })
        });
        await cargarLibros();
        mostrarAviso("Estado de disponibilidad actualizado.", true);
    } catch (error) {
        mostrarAviso(error.message);
    }
}

async function eliminarLibro(libro) {
    if (!window.confirm(`¿Eliminar "${libro.titulo}" de la biblioteca?`)) return;
    limpiarAviso();
    try {
        await solicitar(`/libros/${libro.id}`, { method: "DELETE" });
        await cargarLibros();
        mostrarAviso("Libro eliminado correctamente.", true);
    } catch (error) {
        mostrarAviso(error.message);
    }
}

function limpiarFormulario() {
    formLibro.reset();
    campoId.value = "";
    campoDisponible.checked = true;
    document.getElementById("tituloFormulario").textContent = "Agregar un libro";
    botonGuardar.innerHTML = "<span aria-hidden=\"true\">＋</span> Guardar libro";
    botonCancelar.classList.add("oculto");
}

botonCancelar.addEventListener("click", () => {
    limpiarFormulario();
    limpiarAviso();
});

document.getElementById("formBuscar").addEventListener("submit", (evento) => {
    evento.preventDefault();
    if (!campoFiltroGenero.value.trim()) {
        mostrarAviso("Escribe un género para realizar la búsqueda.");
        campoFiltroGenero.focus();
        return;
    }
    filtroActual = "genero";
    actualizarFiltros();
    cargarLibros();
});

function actualizarFiltros() {
    botonTodos.classList.toggle("activo", filtroActual !== "disponibles");
    botonDisponibles.classList.toggle("activo", filtroActual === "disponibles");
}

botonTodos.addEventListener("click", () => {
    filtroActual = "todos";
    campoFiltroGenero.value = "";
    actualizarFiltros();
    cargarLibros();
});

botonDisponibles.addEventListener("click", () => {
    filtroActual = "disponibles";
    actualizarFiltros();
    cargarLibros();
});

cargarLibros();
