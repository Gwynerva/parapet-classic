/** Indexes an array and throws instead of yielding `undefined` when the index is out of range. */
export function at<T>(array: ArrayLike<T>, index: number, label = 'array'): T {
  const value = array[index];
  if (value === undefined) {
    throw new RangeError(`${label}[${index}] is out of range (length ${array.length})`);
  }
  return value;
}
