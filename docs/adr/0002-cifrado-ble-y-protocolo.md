# 0002. Cifrado de carga útil en BLE y perfil GATT congelado

- **Status:** proposed
- **Date:** 2026-11-12
- **Area:** conexion-ble

## Context

El contrato de datos ESP32 ↔ App v0.1 define nueve características GATT y marca tres de ellas
—Configuración · escritura, Resumen · escritura y Control · escritura— como **«Write
(cifrada)»**. El contrato no dice con qué algoritmo, con qué clave ni cómo se empareja el
teléfono con el bastón. Sin decidir esto, la app no puede escribir en esas características y el
firmware no puede implementarlas.

A esto se suma que el prototipo físico todavía no existe: el UUID de cada característica queda
entonces definido por la app y el firmware tiene que adoptarlo o no habrá interoperabilidad. El
contrato dice que los UUID «se generan al implementar (no inventar a mano)», o sea, con un
generador, y que quedan fijos.

El diseño general (ADR 0001 y §11 del spec) había propuesto el cifrado de enlace BLE (LE Secure
Connections con bonding), pero el contrato marca características concretas como cifradas, lo que
apunta a cifrado de la carga útil.

## Decision

1. **Cifrado de la carga útil con XChaCha20-Poly1305** en las tres características marcadas
   «cifrada», más el **cifrado de enlace** con emparejamiento y PIN (LE Secure Connections).
2. La clave de 32 bytes se deriva con **PBKDF2-HMAC-SHA256** de un PIN de 6 dígitos y una sal
   aleatoria de 16 bytes que viaja en el enlace ya cifrado al emparejar.
3. El **perfil GATT se congela**: los UUID generados quedan en `src/domain/protocol/ble-profile.ts`
   y se publican en `docs/architecture/protocolo-ble.md`, con el formato de trama, el sobre
   cifrado y vectores de prueba para el firmware.
4. La trama es común a todos los mensajes: `opcode(1) | versión(1) | longitud(2 LE) | CRC-16(2 LE) |
   cuerpo`. El CRC va sobre los bytes que viajan, para detectar corrupción de transporte; la
   etiqueta AEAD protege el contenido en claro.
5. El **registro viaja como una línea CSV** con los encabezados del contrato, igual que en el
   archivo de la microSD, para que la sincronización BLE y la importación manual compartan un
   solo códec y un solo pipeline (RF-APP-042).
6. El acceso a BLE pasa por el puerto `BleTransport`, con la implementación real sobre
   `react-native-ble-plx` y una falsa que monta un bastón simulado fiel al contrato.

## Alternatives

- **Solo cifrado de enlace:** más simple y nativo de BLE, pero no cumple la marca «cifrada» de las
  características del contrato y deja la escritura de configuración y del resumen sin protección
  propia.
- **AES-GCM:** más disponible en hardware, pero sin equivalente nativo en React Native sin
  módulo criptográfico adicional; XChaCha20-Poly1305 es puro TypeScript y auditado.
- **Clave fija de fábrica:** elimina el PIN, pero un bastón clonado sería aceptable por cualquier
  teléfono y el resumen del diagnóstico travelaría cifrado con una clave pública.
- **UUID generados en cada compilación:** el firmware no podría referenciarlos de forma estable.

## Consequences

- El firmware necesita implementar el mismo sobre y la misma derivación de clave; los vectores de
  prueba del repo permiten verificar la interoperabilidad antes de tener hardware.
- Se agregan dos dependencias puras (`@noble/ciphers`, `@noble/hashes`) y una nativa
  (`react-native-ble-plx`), que exige compilación nativa del APK.
- El simulador del bastón pasa a hablar el protocolo real, así que la app usa hoy el mismo camino
  de código que usará con el prototipo.
- Si el equipo de firmware prefiere otro algoritmo, el sobre cambia en un solo módulo y los
  vectores de prueba hay que rehacerlos.

## Reversibility

Media. El algoritmo y la biblioteca se pueden cambiar dentro de `src/domain/protocol/encryption.ts`
sin tocar el resto, pero cambiarlo después de que el firmware implemente uno deja los bastones
antiguos incompatibles, así que la decisión debe cerrarse antes de que exista el primer
prototipo.

## Links

- Contrato de datos: Notion «🔌 Contrato de datos ESP32 ↔ App (propuesta v0.1)».
- Diseño: `docs/superpowers/specs/2026-11-12-corte-2-ble-microsd-design.md`.
- Protocolo publicado: `docs/architecture/protocolo-ble.md`.
- ADR-APP-012 (BLE GATT), ADR-APP-013 (sincronización por secuencia), ADR-APP-017
  (configuración de sesión), ADR-FW-011.
