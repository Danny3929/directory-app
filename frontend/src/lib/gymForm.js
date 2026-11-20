// Checks for the owner's gym form. Plain functions, no React. These only give
// quick help in the browser: the server checks everything again (prices, map
// limits, text length), because browser checks can be skipped.
export const LIMITS = { name: 200, address: 200, area: 100, city: 100, zip_code: 10, price: 10_000_000 };

export const EMPTY_GYM = {
  name: '', description: '', address: '', area: '', city: '', zip_code: '',
  latitude: '', longitude: '', price_min: '', price_max: '', tags: [],
};

const text = (value) => String(value ?? '').trim();
// A number box gives back text. '' and 'abc' are not numbers; Number('') would be 0, so check first.
const num = (value) => (text(value) === '' ? NaN : Number(value));

// Gives { box: 'what to fix' } for every box that is wrong, or {} if all is well.
export function gymErrors(values = {}) {
  const errors = {};
  const required = (box, label, max) => {
    const t = text(values[box]);
    if (!t) errors[box] = `Enter ${label}.`;
    else if (max && t.length > max) errors[box] = `Keep this under ${max} characters.`;
  };
  required('name', 'the gym name', LIMITS.name);
  required('description', 'a description');
  required('address', 'the street address', LIMITS.address);
  required('city', 'the city', LIMITS.city);
  required('zip_code', 'the ZIP code', LIMITS.zip_code);
  if (text(values.area).length > LIMITS.area) errors.area = `Keep this under ${LIMITS.area} characters.`;

  const lat = num(values.latitude);
  if (Number.isNaN(lat)) errors.latitude = 'Enter a number like -1.2921.';
  else if (lat < -90 || lat > 90) errors.latitude = 'Latitude must be between -90 and 90.';
  const lng = num(values.longitude);
  if (Number.isNaN(lng)) errors.longitude = 'Enter a number like 36.8219.';
  else if (lng < -180 || lng > 180) errors.longitude = 'Longitude must be between -180 and 180.';

  const low = num(values.price_min);
  const high = num(values.price_max);
  const wholeShillings = (n) => Number.isInteger(n) && n >= 0 && n <= LIMITS.price;
  if (!wholeShillings(low)) errors.price_min = 'Enter whole shillings, like 3000.';
  if (!wholeShillings(high)) errors.price_max = 'Enter whole shillings, like 8000.';
  if (!errors.price_min && !errors.price_max && low > high) {
    errors.price_min = 'Minimum price cannot be above the maximum.';
  }
  return errors;
}

// What goes to the server: text trimmed, numbers as numbers, tags as slugs.
export function toPayload(values) {
  return {
    name: text(values.name),
    description: text(values.description),
    address: text(values.address),
    area: text(values.area),
    city: text(values.city),
    zip_code: text(values.zip_code),
    latitude: Number(values.latitude),
    longitude: Number(values.longitude),
    price_min: Number(values.price_min),
    price_max: Number(values.price_max),
    tags: values.tags,
  };
}

// The other way: a gym from the server -> the form's text boxes.
export function fromGym(gym) {
  return {
    ...EMPTY_GYM,
    ...Object.fromEntries(Object.keys(EMPTY_GYM).filter((k) => k !== 'tags').map((k) => [k, String(gym[k] ?? '')])),
    tags: (gym.tags ?? []).map((t) => (typeof t === 'string' ? t : t.slug)),
  };
}
