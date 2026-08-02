import { isWithinQuietHours } from "../service/alert.service";

console.log("=== Testando isWithinQuietHours ===");

// 1. Desativado
const test1 = isWithinQuietHours({ quietHoursEnabled: false });
console.assert(test1 === false, "Test 1 Falhou: quietHoursEnabled false deve retornar false");

// 2. Sem horários definidos
const test2 = isWithinQuietHours({ quietHoursEnabled: true, quietHoursStart: null, quietHoursEnd: null });
console.assert(test2 === false, "Test 2 Falhou: sem horários deve retornar false");

// 3. Janela 00:00 às 23:59 (cobre o dia todo)
const test3 = isWithinQuietHours({
  quietHoursEnabled: true,
  quietHoursStart: "00:00",
  quietHoursEnd: "23:59",
  timezone: "America/Sao_Paulo",
});
console.assert(test3 === true, "Test 3 Falhou: janela de 00:00 a 23:59 deve cobrir a hora atual");

// 4. Janela nula de 12:00 às 12:00 (iguais)
const test4 = isWithinQuietHours({
  quietHoursEnabled: true,
  quietHoursStart: "12:00",
  quietHoursEnd: "12:00",
  timezone: "America/Sao_Paulo",
});
console.assert(test4 === false, "Test 4 Falhou: horários iguais deve retornar false");

console.log("✅ Todos os testes unitários de isWithinQuietHours passaram!");
