/** Reloj: el tiempo entra por puerto para que los casos de uso no llamen `new Date()`. */
export interface Clock {
  now(): string;
}
