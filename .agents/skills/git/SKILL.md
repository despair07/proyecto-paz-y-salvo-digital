---
name: git
description: Flujo de trabajo Git de Paz & Salvo Digital Uniautónoma — ramas, Conventional Commits con referencia a tareas, pull requests, hotfix y reversión. Úsala antes de crear ramas, hacer commits, abrir PRs o fusionar.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Git — Flujo de trabajo y Conventional Commits

## Ramas

| Rama | Descripción | Regla |
|---|---|---|
| `main` | Código desplegado y funcionando en producción | **Nadie hace commit directo.** Solo recibe merges desde `main` (release) o desde `hotfix/*` |
| `main` | Integración de todas las tareas terminadas; base de las ramas nuevas | Cada tarea se fusiona aquí antes de considerarse lista |
| `feature/PYS-XXX-descripcion` | Una rama por tarea o historia. Ej.: `feature/PYS-001-login` | Se crea desde `main` y vuelve a ella por pull request |
| `fix/PYS-XXX-descripcion` | Corrección no urgente | Igual que `feature/` |
| `hotfix/descripcion` | Solo correcciones urgentes en producción | Se crea desde `main`, se fusiona a `main` con etiqueta y luego a `main` |

> Si el proyecto trabaja con una sola rama (proyecto personal o prototipo), `project-setup` deja `main` = `main` y elimina la parte de release.

### Flujo típico para una tarea

1. Estar en `main` actualizada.
2. Crear `feature/PYS-XXX-descripcion`.
3. Trabajar con commits pequeños y convencionales.
4. Verificar (ver "Antes de subir").
5. Subir la rama y abrir un pull request hacia `main`.
6. Revisión (compañero o usuario) → merge → borrar la rama.

## Conventional Commits

Formato:

```
<tipo>(<módulo>): <descripción> (PYS-XXX)
```

| Tipo | Cuándo se usa | Ejemplo |
|---|---|---|
| `feat` | Nueva funcionalidad | `feat(auth): login con JWT (PYS-001)` |
| `fix` | Corrección de un defecto | `fix(api): valida email duplicado (PYS-004)` |
| `docs` | Documentación | `docs(readme): instrucciones de despliegue` |
| `test` | Pruebas | `test(usuarios): casos de valores límite` |
| `refactor` | Cambio interno sin alterar comportamiento | `refactor(repo): extrae consulta a un método` |
| `style` | Formato o estilos sin cambiar la lógica | `style(ui): ajusta espaciado de cards` |
| `perf` | Mejora de rendimiento | `perf(lista): virtualiza el listado` |
| `chore` | Configuración, dependencias, tareas de mantenimiento | `chore(deps): actualiza framework` |

### Reglas

- Cada commit de código referencia la tarea que atiende (`PYS-XXX`). `docs`/`chore` sueltos pueden omitirla.
- La descripción explica **qué cambió** sin tener que abrir el código; en imperativo o presente, minúscula, sin punto final.
- Idioma de los mensajes: español.
- Un commit = un cambio lógico. No mezclar refactor con feature.
- Cambio que rompe compatibilidad: `feat(api)!: ...` y explicar en el cuerpo `BREAKING CHANGE: ...`.

### Mensajes que no se aceptan

`cambios`, `avance`, `update`, `fix`, `wip`, `asdf`, o cualquier mensaje sin tipo y descripción clara.

## Antes de subir

```bash
(cd paz-y-salvo-backend && npm test)
(cd paz-y-salvo-frontend && npm run build)   # lint aún no configurado (PYS-T01)
```

- Si alguno falla, no se sube como evidencia de tarea terminada.
- Revisar `git status` y `git diff --staged`: nada de `.env`, credenciales, `node_modules/`, builds ni archivos personales.
- Preferir `git add <archivos>` a `git add .` cuando hay cambios ajenos a la tarea.

## Comandos

### Configuración inicial (una vez)

```bash
git config --global user.name "Tu Nombre"
git config --global user.email "tu@email.com"

# Opcional: validar los mensajes con un hook
npm install --save-dev @commitlint/cli @commitlint/config-conventional husky
```

### Flujo normal

```bash
# 1. Actualizar y crear la rama
git checkout main
git pull origin main
git checkout -b feature/PYS-005-adjuntar-documento

# 2. Commits convencionales
git add src/documentos/
git commit -m "feat(documentos): permite adjuntar PDF (PYS-005)"

# 3. Subir y abrir pull request
git push -u origin feature/PYS-005-adjuntar-documento

# 4. Tras la aprobación (si se fusiona en local)
git checkout main
git pull origin main
git merge --no-ff feature/PYS-005-adjuntar-documento
git push origin main

# 5. Borrar la rama
git branch -d feature/PYS-005-adjuntar-documento
git push origin --delete feature/PYS-005-adjuntar-documento
```

### Mantener la rama al día

```bash
git fetch origin
git rebase origin/main   # solo en ramas propias que nadie más usa
```

### Hotfix

```bash
git checkout main
git pull origin main
git checkout -b hotfix/crash-inicio
git commit -m "fix(core): corrige crash al iniciar (HOTFIX-001)"

git checkout main
git merge --no-ff hotfix/crash-inicio
git tag -a v1.0.1 -m "Hotfix: crash al iniciar"
git push origin main --tags

git checkout main
git merge --no-ff hotfix/crash-inicio
git push origin main
```

### Deshacer

```bash
# Commit ya subido: crear un commit inverso (seguro, no reescribe historia)
git revert --no-edit <hash>

# Último commit local NO subido: deshacerlo y conservar los cambios
git reset --soft HEAD~1

# Corregir el mensaje del último commit local NO subido
git commit --amend -m "fix(api): mensaje correcto (PYS-004)"
```

## Prohibido para el agente sin autorización explícita del usuario

- `git push --force` (si hace falta, solo `--force-with-lease` sobre ramas propias).
- `git reset --hard`, `git clean -fd`, borrar ramas remotas ajenas.
- Commits directos en `main`.
- Reescribir historia ya publicada en ramas compartidas.
- Subir secretos. Si se subió uno por error: avisar al usuario y rotar la clave; borrarlo del historial no basta.

## Relación con otras skills

- `project-manager`: el ID de la tarea del tablero es el que va en la rama y en el commit; al cerrar, el hash del commit se registra en `historial.md`.
- `testing`: define los comandos de "Antes de subir".
- `desarrollo`: remite aquí para el criterio de commits.
