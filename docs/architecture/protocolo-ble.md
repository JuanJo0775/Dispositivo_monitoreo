# Protocolo BLE ESP32 ↔ App (v1)

Contrato de datos entre el bastón y la app, según el **Contrato de datos ESP32 ↔ App v0.1** de
Notion. Este documento es la referencia que implementan las dos partes: la app (este repositorio) y
el firmware del ESP32.

- Versión del protocolo: **1**.
- UUID congelados: cambiarlos es un cambio de versión del protocolo.

## 1. Perfil GATT

| Característica | UUID | Propiedades | Contenido |
| --- | --- | --- | --- |
| Servicio | `e962ff5a-2123-4b60-b472-27f62c97902e` | — | Un solo cliente conectado a la vez. |
| Captura | `e605f44c-0ec9-4bf1-9500-c4ed37e3fac2` | Notify | Un registro por pulsación del gatillo. |
| Estado | `5b8479b5-a08b-448c-b5a2-fcb0eaae1ee3` | Read, Notify | Batería, microSD, GPS, firmware, versión de protocolo, hora UTC, contador de registros. |
| Sync · solicitud | `f1d9eaec-c057-4424-8430-8bbf8c0caa44` | Write | «Enviar desde id N». |
| Sync · datos | `5f0bb6a2-26e0-4f05-a551-e37a02db2be2` | Notify | Registros en bloques con MTU negociado y CRC. |
| Sync · confirmación | `57f2fa6a-d641-4915-af5b-e4da1d334861` | Write | Último id recibido y guardado. |
| Configuración · escritura | `642892a2-1d00-469f-a6ef-0dcd5a6d4f29` | Write (**cifrada**) | Configuración de sesión. Incluye CRC. |
| Configuración · estado | `92294ea6-4878-4a50-bbdd-40ca5e0de562` | Read, Notify | Configuración activa y resultado de la última escritura. |
| Resumen · escritura | `43d59275-f1d6-4060-a89f-a8b65d97c7db` | Write (**cifrada**) | Texto corto (máx. 2 líneas) para la OLED. |
| Control · escritura | `edd4b57c-3a7e-4f71-8b0b-c51c0ccd55c2` | Write (**cifrada**) | Capturar ahora, fijar hora. |

## 2. Trama

Todos los mensajes, en las dos direcciones, usan el mismo formato:

```
byte 0     opcode
byte 1     versión del protocolo (1)
bytes 2-3  longitud del cuerpo (uint16, little endian)
bytes 4-5  CRC-16/CCITT-FALSE del cuerpo
bytes 6..  cuerpo
```

- El CRC se calcula sobre **los bytes tal como viajan** (cifrados incluidos). Sirve para detectar
  corrupción de transporte. Polinomio `0x1021`, valor inicial `0xFFFF`, reflexión de entrada y
  salida, resultado `0x29B1` para la cadena `123456789`.
- El cuerpo de un mensaje cifrado es el sobre de la sección 4.
- Multiplicador de fragmentación: el cuerpo se divide en trozos que quepan en la MTU negociada
  menos 6 bytes de cabecera. Cada trozo lleva su propio CRC.

## 3. Opcodes

| Código | Mensaje | Característica | Cifrado |
| --- | --- | --- | --- |
| `0x01` | Captura | Captura | no |
| `0x02` | Estado | Estado | no |
| `0x03` | Sync: solicitud | Sync · solicitud | no |
| `0x04` | Sync: bloque de datos | Sync · datos | no |
| `0x05` | Sync: confirmación | Sync · confirmación | no |
| `0x06` | Configuración de sesión | Configuración · escritura | **sí** |
| `0x07` | Estado de la configuración | Configuración · estado | no |
| `0x08` | Resumen para la OLED | Resumen · escritura | **sí** |
| `0x09` | Control | Control · escritura | **sí** |

## 4. Sobre cifrado

```
byte 0      versión del sobre (1)
bytes 1-24  nonce
bytes 25..  texto cifrado + etiqueta AEAD (16 bytes al final)
```

- Cifrado: **XChaCha20-Poly1305** (clave de 32 bytes, nonce de 24 bytes, etiqueta de 16 bytes).
- Clave: `PBKDF2-HMAC-SHA256(pin, sal, 100000)` con sal de 16 bytes.
- La sal se genera al azar en el emparejamiento, viaja por el enlace ya cifrado y la guarda cada
  parte. El PIN tiene 6 dígitos.
- Un mensaje que no valida la etiqueta se rechaza: no se guarda nada a medias.
- Además, el enlace usa emparejamiento con PIN (LE Secure Connections).

### Vectores de prueba

Estos valores los produce la suite del dominio (`tests/domain/protocol/encryption.test.ts`) y
sirven para verificar que el firmware implementa lo mismo:

<!-- VECTORES -->

## 5. Registro de captura

El registro viaja como **una línea CSV** con estos encabezados, en este orden (los mismos del
archivo de la microSD):

```
id_registro, device_id, fecha, hora_utc, lat, lon, alt_m, vel_kmh, sats, hdop, edad_fix_s,
prof_cm, config_id, cultivo, lote_id, fert_fecha, humedad_pct, temp_c, ph, ce_uscm, n_mgkg,
p_mgkg, k_mgkg, banderas, bat_pct, fw_ver
```

- Los números van con **punto** decimal.
- Un dato sin valor es una **celda vacía**; su bandera lo indica. Nunca un valor por defecto.
- `id_registro` es consecutivo por dispositivo y es la clave de sincronización: junto con
  `device_id` forma la identidad de la captura.
- `banderas` es un entero con los bits: b0 posición válida, b1 fix reciente, b2 sonda OK,
  b3 CE sobre umbral, b4 hora válida, b5 dato simulado.
- `config_id` es 0 cuando el bastón no tiene una configuración válida.

## 6. Configuración de sesión

1. La app arma la configuración: cultivo, lote, profundidad, fecha de última fertilización
   (opcional) y versión de umbrales, con su `config_id`.
2. La app la escribe cifrada en **Configuración · escritura**.
3. El bastón valida el CRC y la etiqueta, la guarda en memoria no volátil y la aplica a todas las
   capturas siguientes, aunque se reinicie.
4. El bastón responde en **Configuración · estado** con el resultado: aceptada, CRC inválido, no
   emparejado o versión incompatible.
5. Cada captura posterior lleva su `config_id`, cultivo, lote y profundidad.

## 7. Sincronización por microSD

1. La app escribe **Sync · solicitud** con el id desde el que quiere (`last_confirmed + 1`).
2. El bastón responde con bloques **Sync · datos**, cada uno con su CRC y del tamaño que permita
   la MTU.
3. La app descarta un bloque con CRC inválido y vuelve a pedir desde el último id confirmado.
4. La app guarda cada registro (deduplicando por `device_id + id_registro`) y escribe **Sync ·
   confirmación** con el último id recibido y guardado.
5. El bastón **no borra nada hasta recibir esa confirmación**.
6. El progreso se cuenta por **registros confirmados**, no por paquetes.

## 8. Resumen para la OLED

La app escribe en **Resumen · escritura** el resultado del diagnóstico en texto corto (máximo dos
líneas). El bastón lo muestra tal cual, sin interpretarlo.
