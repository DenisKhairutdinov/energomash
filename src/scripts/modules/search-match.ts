// Поиск по коду и названию модели: общие правила для списка подсказок в шапке и для фильтра каталога.
// Регистр, «ё», пробелы, дефисы, слеши, точки и скобки не важны: «ппц 20/2», «ППЦ-20-2» и «ппц202» находят одно и то же

export interface Searchable {
  model: string;
  code: string | null;
}

export const normalizeSearch = (value: string): string =>
  value
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replaceAll(/[\s\-_/.,()]+/g, '');

// Слова запроса: каждое должно встретиться в названии или коде, порядок не важен
export const parseQuery = (query: string): string[] =>
  query
    .trim()
    .split(/\s+/)
    .map((token) => normalizeSearch(token))
    .filter((token) => token !== '');

const haystacks = new WeakMap<Searchable, string>();

// Строка для сравнения запоминается: фильтр каталога проверяет карточки много раз за одно изменение
const haystackOf = (item: Searchable): string => {
  let haystack = haystacks.get(item);

  if (haystack === undefined) {
    haystack = normalizeSearch(`${item.model} ${item.code ?? ''}`);
    haystacks.set(item, haystack);
  }

  return haystack;
};

export const isSearchMatch = (item: Searchable, tokens: string[]): boolean => {
  const haystack = haystackOf(item);

  return tokens.every((token) => haystack.includes(token));
};

// Чем меньше число, тем выше результат: точный код, затем название, начинающееся с запроса, затем остальные
export const searchRank = (item: Searchable, tokens: string[]): number => {
  const [first = ''] = tokens;
  const model = normalizeSearch(item.model);

  if (item.code !== null && normalizeSearch(item.code) === first) {
    return 0;
  }

  if (model === first) {
    return 1;
  }

  return model.startsWith(first) ? 2 : 3;
};
