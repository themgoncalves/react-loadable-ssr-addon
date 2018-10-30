/**
 * react-loadable-ssr-addon
 * @author Marcos Gonçalves <contact@themgoncalves.com>
 * @version 0.1.5
 */

/**
 * Checks if object array already contains given value
 * @method isDuplicated
 * @function
 * @param {array} target - Object array to be inspected
 * @param {string} targetKey - Object key to look for
 * @param {string} searchFor - Value to search existence
 * @returns {boolean}
 */
export default function isDuplicated(target, targetKey, searchFor) {
  for (let i = 0; i < target.length; i += 1) {
    const file = target[i][targetKey];
    if (file === searchFor) { return true; }
  }

  return false;
}
