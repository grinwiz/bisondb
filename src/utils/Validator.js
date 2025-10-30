class Validator {
  /**
   * Ensures value is a non-null object (not array).
   * @param {*} value
   * @param {string} message
   */
  static object(value, message = 'Value must be a non-null object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(message);
    }
  }

  /**
   * Ensures value is a non-empty string.
   * @param {*} value
   * @param {string} message
   */
  static string(value, message = 'Value must be a non-empty string') {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(message);
    }
  }

  /**
   * Ensures value is a non-null, non-undefined.
   * @param {*} value
   * @param {string} message
   */
  static defined(value, message = 'Value must be defined') {
    if (value === null || value === undefined) {
      throw new Error(message);
    }
  }

  /**
   * Ensures value is an array with at least one element.
   * @param {*} value
   * @param {string} message
   */
  static array(value, message = 'Value must be a non-empty array') {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error(message);
    }
  }

  /**
   * Ensures value is a number (including 0, NaN allowed if needed).
   * @param {*} value
   * @param {string} message
   */
  static number(value, message = 'Value must be a number') {
    if (typeof value !== 'number') {
      throw new Error(message);
    }
  }
}

module.exports = { Validator };