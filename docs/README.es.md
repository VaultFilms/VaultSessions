<p align="center"><img src="../VaultSessions/icons/leaf-128.png" width="64" height="64" alt="VaultSessions"></p>
<h1 align="center">VaultSessions</h1>

<h3 align="center">Reúne a tus propios asistentes de IA.</h3>

<p align="center">
  <a href="../README.md">English</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.id.md">Indonesia</a> |
  <a href="README.pt-BR.md">Português</a> |
  <a href="README.hi.md">हिन्दी</a>
</p>

<p align="center">
  <a href="https://www.youtube.com/watch?v=89KXgu_0Fm8">
    <img src="introduction-compact.gif" alt="VaultSessions Demo" width="700">
  </a>
</p>

**Una aplicación de reuniones de código abierto donde las personas y sus asistentes personales de IA —ChatGPT, Gemini y Claude— pueden pensar y colaborar juntos, aprovechando su personalización existente.**

## Funciones

- **Trae la personalidad de tus propias IA.** Conecta los chats web oficiales que ya usas, con sus conversaciones y personalización existentes. No necesitas claves de API de IA.
- **Discusiones grupales naturales.** Las IA conectadas participan por turnos, aportan perspectivas nuevas y pasan cuando no tienen nada que agregar. Si solo hay una IA conectada, da una sola respuesta.
- **Elige naturalmente quién responde primero.** Usa `@GPT`, `@ChatGPT`, `@Gemini`, `@Claude` o `To Gemini`. Sin una indicación, la primera IA se elige al azar.
- **Comparte contexto visual.** Adjunta o pega hasta cuatro imágenes y coméntalas por su número.
- **Comparte la página actual.** Si quieres, proporciona el texto legible de una página como material de referencia.
- **Resume y copia.** Genera un resumen para revisarlo después o usarlo en otra reunión.
- **Panel lateral y vista ampliada.** Cambia la presentación, oculta los controles de participantes y ajusta el tamaño del texto del registro.
- **Nueve idiomas de interfaz.** Inglés, japonés, francés (Francia), alemán (Alemania), español (Estados Unidos), italiano, indonesio, portugués (Brasil) e hindi. La selección inicial sigue las preferencias del navegador; si no hay un idioma compatible, se usa inglés. Las elecciones manuales se recuerdan. El modo oscuro sigue la configuración del navegador o del sistema.

VaultSessions es una prueba de concepto de una interfaz de reuniones que integra distintos contextos y personalidades de IA con perspectivas humanas. No está afiliado a OpenAI, Google ni Anthropic, ni cuenta con su respaldo.

## Instalación

```text
VaultSessions/
├── README.md
├── LICENSE
├── SECURITY.md
├── docs/
└── VaultSessions/       ← Carga esta carpeta en Chrome
    ├── manifest.json
    ├── meeting.html
    ├── start.command
    ├── start.bat
    ├── serve.py
    ├── icons/
    ├── i18n/
    └── ...
```

1. Descarga o clona este repositorio en una carpeta que vayas a conservar.
2. Abre `chrome://extensions/` y activa el **Modo de desarrollador**.
3. Haz clic en **Cargar extensión sin empaquetar** y selecciona la carpeta interior **`VaultSessions/`** que contiene `manifest.json`, no la raíz del repositorio.
4. Abre los sitios oficiales de ChatGPT, Gemini y/o Claude e inicia sesión por tu cuenta.
5. Haz clic en el ícono de la extensión VaultSessions desde la pestaña donde quieras mostrar el panel de reunión.

Usa una versión reciente de Chrome. El manifiesto exige como mínimo Chrome 116, pero la compatibilidad de las API del navegador y de las interfaces de los proveedores puede variar. Las reuniones normales no requieren compilación ni servidor.

Después de actualizar los archivos, recarga la extensión, las pestañas oficiales de las IA y la vista de reunión.

**Compatibilidad con Windows:** Se incluyen instrucciones de instalación y un archivo de inicio para Windows, pero VaultSessions aún no se ha probado en un equipo Windows. Falta verificar en Windows el foco de las ventanas, la entrada con IME, el pegado de imágenes desde el portapapeles y el cambio entre el panel lateral y la pantalla completa.

### Vista ampliada sin servidor

1. En **Detalles** de la extensión, activa **Permitir acceso a las URL de archivo**.
2. Abre `VaultSessions/meeting.html` en Chrome.
3. Haz clic en **Registrar esta página de reunión** para guardar su URL local exacta en el almacenamiento local de la extensión.
4. Usa los controles del encabezado para alternar entre el panel lateral y la vista ampliada.

Si mueves la carpeta, debes abrir y registrar de nuevo `meeting.html` en su ubicación nueva. Al pasar del panel lateral a la vista ampliada se reutiliza la pestaña actual; el botón Atrás del navegador permite volver al sitio anterior. Los registros se transfieren, pero puede ser necesario reconectar las IA.

### Modo localhost opcional

Algunos paneles de IA del navegador no pueden interactuar con páginas `file://`. Para esas integraciones, instala Python 3 e inicia el servidor opcional de bucle local:

| Plataforma | Lanzador | Alternativa en terminal, desde la carpeta interior `VaultSessions/` |
| --- | --- | --- |
| macOS | Haz doble clic en `VaultSessions/start.command` | `python3 serve.py` |
| Windows | Haz doble clic en `VaultSessions/start.bat` | `py -3 serve.py` o `python serve.py` |

Si el lanzador de macOS perdió su permiso de ejecución, usa `chmod +x start.command` o el comando de terminal anterior. Mantén abierta la ventana de terminal; Ctrl+C detiene el servidor. El puerto 8766 debe estar libre.

En la reunión abierta como archivo, haz clic en **?** y usa el botón para verificar el servidor y abrir localhost en el cuadro de ayuda. Verifica el servidor y guarda el registro actual antes de cambiar de vista. La dirección es `http://127.0.0.1:8766/meeting.html`.

El servidor solo sirve archivos de la carpeta interior `VaultSessions/` mediante bucle local. No guardes secretos ni archivos personales ahí. La extensión debe seguir habilitada en ambos modos.

## Uso

### Iniciar una reunión

Las pestañas de IA disponibles se conectan automáticamente. Si un proveedor tiene varias abiertas, elige la conversación deseada. Puedes desconectar una IA sin cerrar su pestaña; la reconexión automática se pausa en esa vista hasta que vuelvas a conectarla.

Escribe un tema y presiona Enter. Shift+Enter inserta una nueva línea; durante la composición con un IME no se envía el mensaje. Con varias IA conectadas, las demás participan en orden después de la primera respuesta. Puedes indicar el primer destinatario en cualquier parte del mensaje; no se distinguen mayúsculas de minúsculas y se toma la primera indicación explícita.

Los límites predeterminados son **3 intervenciones** y **6 solicitudes**. PASS cuenta como solicitud, no como intervención. La discusión también termina si todos los participantes conectados pasan su turno consecutivamente. Usa **Detener discusión** para impedir los siguientes turnos; quizá sea necesario terminar de recuperar una respuesta en curso antes de desbloquear la entrada.

Las pestañas de IA pasan al frente al enviar y recuperar respuestas. Evita editar esas conversaciones o navegar a otras durante un turno. La protección de entrada ayuda a evitar escritura accidental al cambiar el foco. Las instrucciones de rol son mensajes de chat normales, no roles del sistema; no se garantiza la conservación de la personalidad ni el cumplimiento de las instrucciones.

### Imágenes y resúmenes

Adjunta hasta cuatro imágenes PNG, JPEG o WebP: **5 MB cada una y 10 MB en total**. Pégalas en el campo de mensaje o usa el botón para adjuntar. Si lo pegado incluye una imagen, se prioriza su procesamiento sobre el texto. Revisa la vista previa y quita los archivos que no quieras enviar.

VaultSessions pasa las imágenes a la pestaña oficial de IA dentro del navegador, sin un servidor intermediario operado por el proyecto. Después, el sitio oficial las sube al proveedor al enviarlas. La numeración empieza de nuevo con cada mensaje humano que incluye imágenes.

**Resumir discusión** elige al azar una IA conectada y disponible. No inicia otra ronda y no aplica la recomendación de 300 caracteres. Si funciona, el resumen reemplaza el registro mostrado y el historial normal de la app. Cópialo si quieres conservarlo. Si falla, el registro previo permanece. Los resúmenes se excluyen del historial que la app envía a discusiones posteriores y de las entradas de futuros resúmenes; los mensajes ya enviados permanecen en la conversación del proveedor.

### Visualización y almacenamiento temporal

El menú del encabezado oculta los controles de participantes y configuración. **A−**, **A＋** y **Restablecer tamaño** ajustan el texto del registro, incluidos los resúmenes, entre 75% y 175%. El ajuste se comparte entre vistas y se conserva después de reiniciar el navegador.

Las instantáneas temporales usan `chrome.storage.session`, con hasta 500 entradas mostradas y 500 entradas de historial normal por guardado. La vista activa puede contener más. No es un archivo permanente. El idioma, el tamaño del texto, la preferencia de compartir páginas y la URL del archivo registrado usan almacenamiento local del navegador. Las imágenes seleccionadas pero no enviadas no se conservan al cambiar de vista.

### Privacidad, permisos y compatibilidad

**Esta no es una aplicación sin conexión ni limitada al bucle local.** La coordinación de la extensión y la transferencia de imágenes ocurren dentro del navegador, pero los sitios oficiales de IA envían mensajes, imágenes y texto de páginas compartidas a sus servicios. VaultSessions no llama directamente a las API de IA ni necesita un servidor intermediario operado por el proyecto.

La inspección estática del código encontró un solo `fetch` explícito: la comprobación opcional de `http://127.0.0.1:8766/meeting.html`. No se identificó un cliente de analítica independiente, un cargador de scripts remotos o CDN, ni un cliente directo de API de IA externa. Es un hallazgo del código, **no una auditoría con tráfico de red registrado**, ni una afirmación de que no haya comunicación externa.

Compartir una página puede incluir información privada visible en páginas donde iniciaste sesión. Desactívalo en las páginas que no quieras compartir. Quitar parámetros de la URL no elimina datos privados del texto. Consulta [SECURITY.md](../SECURITY.md) para conocer los permisos, el flujo de datos y cómo reportar problemas de seguridad.

**VaultSessions automatiza sitios oficiales de IA con sesiones iniciadas. Esto puede entrar en conflicto con los términos o las reglas de cuenta de un proveedor. Revisa los términos aplicables y úsalo bajo tu propia responsabilidad. Los cambios en interfaces, API del navegador, funciones o términos pueden hacer que deje de funcionar o que sea necesario dejar de usarlo.** La app no evita CAPTCHA ni límites de uso. Que sea código abierto no implica una auditoría independiente ni seguridad garantizada.

### Contribuir

¡Las contribuciones son bienvenidas!

Haz un fork de este repositorio, mejora VaultSessions y envía un Pull Request.

Construyamos una mejor forma de pensar juntos, humanos e IA.

Esta distribución no incluye la suite interna de pruebas. Describe cómo verificaste tus cambios, especialmente si afectan los adaptadores DOM de los proveedores. Consulta [VaultSessions/i18n/README.md](../VaultSessions/i18n/README.md) para agregar un idioma.

## Licencia

[MIT](../LICENSE) — Copyright (c) 2026 VaultFilms.

El software se proporciona **TAL CUAL, SIN GARANTÍA**. Conserva los avisos de derechos de autor, permiso y exclusión de garantía al redistribuirlo. La licencia no autoriza a ignorar los términos de servicios de terceros.

Creado por [VaultFilms](https://www.youtube.com/channel/UCmiLs19uM0in4ubeyvPHLIQ).
