# Soul of Dispositivo de monitoreo del suelo (app móvil)

<!-- Draft 2026-11-12, derived from Notion v0.1. Keep at 80 lines or less. -->

## Purpose

App Android que se conecta por BLE al bastón de monitoreo de suelo, recibe capturas de la sonda
(pH, humedad, temperatura, CE, N, P, K) con posición GPS, las guarda, las diagnostica contra
umbrales agronómicos versionados y las exporta. Todo funciona sin internet: el bastón captura y la
app conecta, recibe, guarda, analiza, mapea y exporta (modelo offline first).

## Users

- Agricultor: mide en campo y necesita un veredicto comprensible, sin formación técnica.
- Técnico o investigador: valida, calibra, revisa historial y exporta datos para Excel o QGIS.
- Sistema y bastón: actores de los flujos de sincronización, configuración de sesión y estado.

## Non-negotiable rules

- Nada central depende de internet ni de un servidor. Sin cuentas ni nube en el MVP.
- Regla del mensurando: un umbral solo aplica si mide lo mismo que la sonda. Solo la humedad admite
  diagnóstico absoluto; CE es enclavamiento de seguridad; pH tiene confianza media tras calibrar;
  P y K solo mapeo relativo; N se estima desde materia orgánica y nunca se muestra como medido.
- Incertidumbre obligatoria: si el intervalo de una lectura cruza clases, la app reporta el
  intervalo y no elige una clase.
- Validez temporal: una medición dentro de 3 a 4 meses después de fertilizar no es válida para
  diagnóstico de nutrientes.
- Cada sonda se calibra individualmente; los datos crudos son inmutables y la calibración se aplica
  en la app.
- Umbrales y ecuaciones son datos versionados, no constantes en el código.
- Todo diagnóstico guarda versión de umbrales, calibración, motor y firmware; sin las cuatro es
  inválido y no se muestra como resultado final.
- Internamente todo se guarda en UTC; al usuario se muestra UTC−5. Interfaz en español de Colombia.
- Un dato sin valor se guarda vacío con su bandera; nunca se escribe un valor por defecto.
- Cero transmisión de datos de usuario sin una acción explícita.
- Solo Android en el MVP, entregado como APK. iOS queda fuera de alcance.

## Quality bar

- 0 pérdidas de datos en 50 ciclos de cierre forzado durante la sincronización.
- 0 diagnósticos con clase única cuando el intervalo abarca más de una clase.
- ≥ 90 % de cobertura de pruebas en el motor de diagnóstico.
- Captura reflejada en pantalla en ≤ 2 s en el 95 % de los casos.
- Arranque en frío ≤ 3 s con 5 000 mediciones.
- Zonas táctiles ≥ 48 dp y contraste ≥ 4.5:1; estados distinguibles sin color.
- 0 bloqueos en 100 desconexiones forzadas de BLE.
- Migración de datos probada desde cualquier versión publicada.

## Standards that apply

- ISO/IEC 25010 para calidad de producto e ISO/IEC 25012 para calidad de datos.
- Ley 1581 de 2012 (Colombia) para datos personales: aviso de privacidad y consentimiento.
- Contrato de datos ESP32 ↔ App v0.1 para el registro de captura y el perfil BLE.

## Where requirements live

- Notion, página raíz "Dispositivo de monitoreo del suelo":
  `https://app.notion.com/p/40439c4a833b80ab9be5e708777b1497`
- Requisitos funcionales app móvil: data source `collection://77d39c4a-833b-82e4-8810-870de4b8d062`
  (RF-APP-001 a RF-APP-065).
- Requisitos no funcionales app móvil: `collection://a5039c4a-833b-83f0-a447-07068b621bae`.
- ADRs app móvil: `collection://dfe39c4a-833b-8315-88ec-07f76cfec317` (ADR-APP-001 a ADR-APP-017).
- Contrato ESP32 ↔ App: página `40439c4a833b81b6bf0cc03354259734`.
- Mapa de pantallas: página `40439c4a833b819291dfefd7dc545b88`.
- Umbrales, ecuaciones y motor (Objetivo 1, v2): copia local en
  `docs/requirements/objetivo-1-umbrales-ecuaciones-motor.md`; original en
  `F:\uni\Z- Semillero baston\objetivo 1\V2\`.
- Sin acceso a Notion: decirlo y trabajar solo con lo que haya en el repo; nunca inventar requisitos.

## Decisions an agent must ask about

- Cambiar el alcance de un corte (MVP / v1.0 / v2.0) o la fecha del MVP.
- Cambiar el framework, la base de datos o el modelo offline first (ADR-APP-001/003/004).
- Alterar umbrales, ecuaciones o la regla del mensurando.
- Publicar, firmar o distribuir el APK.
- Tocar datos reales de agricultores o exportarlos fuera del teléfono.