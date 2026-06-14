// p5 runs in global mode. The sound and SVG add-ons are UMD bundles that look
// up p5 on the global object, so window.p5 must be assigned before they load.
// Keeping the assignment in a dedicated module guarantees it runs before the
// add-on imports are evaluated, since ES modules evaluate their dependencies in
// import order.
import p5 from 'p5';

if (typeof window !== 'undefined') {
  window.p5 = p5;
}

export default p5;
