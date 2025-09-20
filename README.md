La lógica del script se basará en los siguientes pasos:

Leer el Directorio: Recorrerá de forma recursiva las carpetas server y client de tu proyecto.
Ignorar Archivos Irrelevantes: Omitirá directorios como node_modules, dist, .next, etc., para centrarse solo en tu código fuente.
Analizar el Código (Análisis Estático Simplificado):
Usará expresiones regulares (regex) para "leer" el código y encontrar patrones clave.
En el Backend (NestJS): Buscará decoradores como @Controller, @Injectable, @WebSocketGateway y las inyecciones de dependencias en los constructores para entender las relaciones.
En el Frontend (Next.js): Buscará llamadas fetch a tu API (/api/...) y el uso de useSocket para identificar las conexiones con el backend.
Construir un Modelo de la App: Creará una representación interna de los componentes (controladores, servicios, páginas, etc.) y cómo se conectan entre sí.
Generar el Código Mermaid: Traducirá ese modelo interno a la sintaxis de Mermaid, creando los nodos y las flechas que los conectan.

----------------------

¿Cómo usarlo?
Instala las dependencias necesarias: Este script usa ts-node para ejecutarse directamente sin necesidad de compilarlo a JavaScript primero.

bash
npm install -g typescript ts-node

Guarda el archivo: Guarda el código anterior como mermaid-generator.ts en la carpeta raíz de tu proyecto,

Ejecuta el script: Abre una terminal en la raíz de tu proyecto y ejecuta el siguiente comando:

bash
ts-node mermaid-generator.ts

Revisa el resultado: El script creará un archivo llamado architecture.md en la misma carpeta. Este archivo contendrá el código Mermaid listo para ser visualizado.


Limitaciones y Mejoras:

Análisis con Regex: Este script usa expresiones regulares por simplicidad. Es rápido y funciona bien para patrones conocidos, pero puede fallar con código más complejo. La forma "profesional" de hacerlo es usando un AST (Abstract Syntax Tree) con librerías como @babel/parser o el propio compilador de TypeScript, que convierten el código en un objeto estructurado mucho más fácil y fiable de analizar.
Especificidad: Si añades un nuevo tipo de componente (ej. un Guard en NestJS), tendrías que añadir la lógica para detectarlo.
Interacciones complejas: No detecta todas las interacciones posibles, como llamadas indirectas entre servicios, pero sí captura las más importantes (Cliente -> API, Controller -> Service, Service -> DB, etc.).

¡Espero que esta herramienta te sea de gran utilidad para visualizar y entender mejor tu proyecto!
Abierto a mejoras y pull requests.
