export function formatBrazilDate(date: Date) {

  return new Intl.DateTimeFormat(
    "sv-SE",
    {
      timeZone:"America/Sao_Paulo"
    }
  ).format(date);

}