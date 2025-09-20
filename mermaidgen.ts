import * as fs from 'fs';
import * as path from 'path';

// --- CONFIGURACIÓN ---
const projectRoot = __dirname; // Asume que el script está en la raíz del proyecto
const serverDir = path.join(projectRoot, 'server', 'src');
const clientDir = path.join(projectRoot, 'client', 'app');
const outputFileName = 'architecture.md';

const ignoreDirs = ['node_modules', '.next', 'dist', 'logs', 'public'];
const ignoreFiles = ['.DS_Store', 'package-lock.json', 'yarn.lock'];

// --- TIPOS DE DATOS PARA MODELAR LA APP ---
interface Component {
  id: string;
  type: 'ClientPage' | 'Controller' | 'Service' | 'Gateway' | 'Database' | 'User';
  label: string;
  filePath: string;
  subgraph: 'Client' | 'Server' | 'Database' | 'User';
}

interface Interaction {
  from: string;
  to: string;
  label: string;
  isAsync?: boolean;
}

// --- LÓGICA PRINCIPAL ---

async function main() {
  console.log('Analizando el proyecto para generar el diagrama Mermaid...');

  const components: Map<string, Component> = new Map();
  const interactions: Interaction[] = [];

  // 1. Analizar Backend (NestJS)
  const serverFiles = await getProjectFiles(serverDir);
  for (const file of serverFiles) {
    const content = await fs.promises.readFile(file, 'utf-8');
    analyzeServerFile(file, content, components, interactions);
  }

  // 2. Analizar Frontend (Next.js)
  const clientFiles = await getProjectFiles(clientDir);
  for (const file of clientFiles) {
    const content = await fs.promises.readFile(file, 'utf-8');
    analyzeClientFile(file, content, components, interactions);
  }
  
  // 3. Añadir componentes que no están en el código (Usuario, DB)
  addExternalComponents(components);

  // 4. Generar el código Mermaid
  const mermaidCode = generateMermaidCode(components, interactions);

  // 5. Escribir el resultado en un archivo Markdown
  const markdownContent = `# Diagrama de Arquitectura del Proyecto\n\n\`\`\`mermaid\n${mermaidCode}\n\`\`\``;
  await fs.promises.writeFile(path.join(projectRoot, outputFileName), markdownContent);

  console.log(`¡Diagrama generado con éxito en '${outputFileName}'!`);
}

// --- FUNCIONES DE ANÁLISIS ---

function analyzeServerFile(filePath: string, content: string, components: Map<string, Component>, interactions: Interaction[]) {
  const controllerMatch = content.match(/@Controller\('([^']*)'\)/);
  const serviceMatch = content.match(/@Injectable\(\)/);
  const gatewayMatch = content.match(/@WebSocketGateway\(\)/);
  const classNameMatch = content.match(/export class (\w+)/);

  if (!classNameMatch) return;
  const id = classNameMatch[1];

  if (controllerMatch) {
    const route = `/api${controllerMatch[1]}`;
    components.set(id, { id, type: 'Controller', label: `${id}<br><small>${route}</small>`, filePath, subgraph: 'Server' });
  } else if (serviceMatch) {
    components.set(id, { id, type: 'Service', label: id, filePath, subgraph: 'Server' });
  } else if (gatewayMatch) {
    components.set(id, { id, type: 'Gateway', label: `${id}<br><small>WebSocket</small>`, filePath, subgraph: 'Server' });
  }

  // Analizar dependencias en el constructor
  const constructorMatch = content.match(/constructor\(([^)]*)\)/);
  if (constructorMatch) {
    const params = constructorMatch[1].split(',').map(p => p.trim());
    for (const param of params) {
      const depMatch = param.match(/(?:private|public|protected)?\s*(?:readonly)?\s*\w+\s*:\s*(\w+)/);
      if (depMatch) {
        const dependencyId = depMatch[1];
        interactions.push({ from: id, to: dependencyId, label: 'inyecta' });
      }
    }
  }
  
  // Analizar uso de Prisma
  if (content.includes('PrismaService')) {
    interactions.push({ from: id, to: 'PrismaService', label: 'usa' });
  }
}

function analyzeClientFile(filePath: string, content: string, components: Map<string, Component>, interactions: Interaction[]) {
  const relativePath = path.relative(clientDir, filePath).replace(/\\/g, '/').replace(/\/page\.tsx$/, '');
  const id = `Page(${relativePath || '/'})`;
  const label = `/${relativePath || ''}`;
  
  components.set(id, { id, type: 'ClientPage', label, filePath, subgraph: 'Client' });
  
  // Analizar llamadas a la API
  const fetchMatches = [...content.matchAll(/fetch\(`\$\{apiUrl\}\/api\/([^`]*)`/g)];
  for (const match of fetchMatches) {
    const endpoint = match[1].split('/')[0]; // Tomar la primera parte de la ruta
    const targetController = findControllerByRoute(endpoint, components);
    if (targetController) {
      interactions.push({ from: id, to: targetController.id, label: `GET /api/${endpoint}` });
    }
  }

  // Analizar uso de WebSockets
  if (content.includes('useSocket()')) {
    const gateway = findComponentByType('Gateway', components);
    if (gateway) {
      interactions.push({ from: id, to: gateway.id, label: 'conecta a', isAsync: true });
    }
  }
}

function addExternalComponents(components: Map<string, Component>) {
  components.set('User', { id: 'User', type: 'User', label: '👤 Usuario', filePath: '', subgraph: 'User' });
  components.set('Database', { id: 'Database', type: 'Database', label: '🗄️ Base de Datos', filePath: '', subgraph: 'Database' });
  
  // Conectar PrismaService a la base de datos
  if (components.has('PrismaService')) {
    interactions.push({ from: 'PrismaService', to: 'Database', label: 'consulta' });
  }
}

// --- FUNCIONES DE GENERACIÓN DE MERMAID ---

function generateMermaidCode(components: Map<string, Component>, interactions: Interaction[]): string {
  let mermaidStr = 'graph TD\n';

  // Definir subgrafos
  const subgraphs: Record<string, string[]> = {
    User: [],
    Client: [],
    Server: [],
    Database: [],
  };

  components.forEach(comp => {
    subgraphs[comp.subgraph]?.push(`    ${comp.id}["${comp.label}"]`);
  });

  for (const subgraphName in subgraphs) {
    if (subgraphs[subgraphName].length > 0) {
      mermaidStr += `  subgraph ${subgraphName}\n`;
      mermaidStr += subgraphs[subgraphName].join('\n') + '\n';
      mermaidStr += '  end\n';
    }
  }
  
  mermaidStr += '\n  %% Interacciones\n';

  // Añadir interacciones
  interactions.forEach(inter => {
    const fromNode = components.get(inter.from);
    const toNode = components.get(inter.to);
    if (fromNode && toNode) {
      const arrow = inter.isAsync ? '-.->' : '-->';
      mermaidStr += `  ${inter.from} ${arrow}|${inter.label}| ${inter.to}\n`;
    }
  });
  
  // Añadir interacción implícita del usuario con las páginas
  components.forEach(comp => {
    if (comp.type === 'ClientPage') {
      mermaidStr += `  User -->|navega a| ${comp.id}\n`;
    }
  });

  // Añadir estilos
  mermaidStr += `
  %% Estilos
  classDef client fill:#233,stroke:#39c,stroke-width:2px,color:#fff
  classDef server fill:#333,stroke:#f90,stroke-width:2px,color:#fff
  classDef db fill:#444,stroke:#ccc,stroke-width:2px,color:#fff
  classDef user fill:#111,stroke:#999,stroke-width:2px,color:#fff

  class ${[...components.values()].filter(c => c.subgraph === 'Client').map(c => c.id).join(',')} client
  class ${[...components.values()].filter(c => c.subgraph === 'Server').map(c => c.id).join(',')} server
  class ${[...components.values()].filter(c => c.subgraph === 'Database').map(c => c.id).join(',')} db
  class ${[...components.values()].filter(c => c.subgraph === 'User').map(c => c.id).join(',')} user
  `;

  return mermaidStr;
}


// --- FUNCIONES DE UTILIDAD ---

async function getProjectFiles(dir: string): Promise<string[]> {
  let files: string[] = [];
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (ignoreDirs.includes(entry.name)) {
      continue;
    }
    if (entry.isDirectory()) {
      files = files.concat(await getProjectFiles(fullPath));
    } else if (!ignoreFiles.includes(entry.name) && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      files.push(fullPath);
    }
  }
  return files;
}

function findControllerByRoute(route: string, components: Map<string, Component>): Component | undefined {
  for (const comp of components.values()) {
    if (comp.type === 'Controller' && comp.label.includes(`/api/${route}`)) {
      return comp;
    }
  }
  return undefined;
}

function findComponentByType(type: Component['type'], components: Map<string, Component>): Component | undefined {
  for (const comp of components.values()) {
    if (comp.type === type) {
      return comp;
    }
  }
  return undefined;
}

// Iniciar la ejecución
main().catch(console. Error);
