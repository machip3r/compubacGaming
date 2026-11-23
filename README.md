# CompuBac Gaming

Panel de CompuBac Gaming para la operación diaria de un pequeño negocio de videojuegos. El MVP prioriza estaciones, sesiones, temporizadores persistidos, tarifas iniciales y registro de cobros.

## Estructura

- `src/domain.ts`: modelos tipados, datos iniciales y funciones puras de tiempo e importe.
- `src/db.ts`: esquema Dexie versionado e inicialización idempotente del catálogo.
- `src/App.tsx`: vistas de operación, historial, finanzas, gastos y configuración de tarifas.
- `src/Calculator.tsx`: supuestos de costos, capacidad mensual, precios de equilibrio/objetivo y escenarios de rentabilidad.
- `src/style.css` y `src/brand.css`: sistema visual responsive en Poppins con fuentes de sistema de respaldo, azul marino `#142648`, turquesa `#51d7dd` y fondos claros de marca.
- `public/brand/`: logotipos locales de CompuBac usados en navegación y favicon.

## Datos y reglas

IndexedDB (`gamehub-local`, versión 1) contiene `consoles`, `sessions`, `sessionExtensions`, `tariffPlans`, `payments`, `expenses` y `settings`. Ese identificador se conserva para mantener los datos creados anteriormente. Las sesiones guardan timestamps y la tarifa capturada al iniciar; el tiempo se calcula desde `startedAt` al renderizar, sin escrituras periódicas. La inicialización crea las cuatro estaciones, los paquetes sugeridos, moneda MXN y zona horaria `America/Mexico_City`, sin datos financieros ficticios. La preferencia de tema también queda guardada.

Una estación admite una sola sesión activa. Las sesiones prepagadas congelan minutos y precio al inicio; una extensión de 30 minutos añade una extensión y un pago relacionado en una transacción. Las sesiones libres se cobran por minuto iniciado con la tarifa guardada. Cada pago tiene estado pagado o pendiente y se crea junto a cambios de sesión dentro de una transacción. Al completar, se registra sólo el saldo restante, evitando duplicar el prepago.

El historial permite editar sesiones completadas y eliminar cualquier sesión junto con sus pagos y extensiones relacionados. Al editar un importe, el sistema conserva los pagos ya realizados y vuelve a calcular el saldo pendiente. Los pagos pendientes se pueden marcar como cobrados desde Finanzas; los gastos del negocio también se registran allí y alimentan el resultado real de la calculadora.

## Desarrollo

```sh
pnpm install
pnpm dev
```

Cada operación se confirma en una transacción de IndexedDB, por lo que cerrar la ventana no interrumpe los registros ya guardados. En Configuración puedes descargar un CSV de sesiones, extensiones, pagos y gastos, un respaldo JSON completo o restaurar ese respaldo. La información sigue ligada a los datos del navegador; conserva el JSON en otro lugar para recuperarla si se borra el almacenamiento del navegador o cambias de dispositivo.
