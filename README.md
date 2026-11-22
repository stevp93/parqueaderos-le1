# Portería digital · Conjunto Residencial La Esperanza 1

Versión de pruebas del **Módulo 1 (acceso y recaudo)** del software de gestión del parqueadero de visitantes, desarrollado por **SP Automatizaciones**.

- Registro de ingreso con foto tomada en vivo y sellada en el servidor (marca de agua inalterable, huella SHA-256 encadenada).
- Destino validado: 43 torres, apartamentos 101 a 604 (pisos 1 a 6, cuatro por piso).
- Cobro electrónico por hora o fracción con QR (en esta versión, pasarela en modo simulado).
- Celular del visitante obligatorio, con autorización: recibe por WhatsApp el enlace de pago y el recibo (entrada, salida, tiempo y valor).
- Sesión única por guarda y turnos con acta de entrega y recibo de los vehículos que siguen dentro.
- Salidas sin pago como deuda de la placa (alerta al volver a entrar); se retiró el cargo al apartamento.
- Tablero, registros, conciliación diaria y ajustes para la administración.

Esta carpeta contiene solo la aplicación web estática. El servidor (base de datos y funciones) está en Supabase y no forma parte de este repositorio.

© 2026 SP Automatizaciones · Soacha, Colombia. Todos los derechos reservados.
