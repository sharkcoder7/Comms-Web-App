import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import { toString, Node } from "hast-util-to-string";
import { lowlight, Root } from "lowlight";

export async function parsePostHTML(html: string) {
  const file = await unified()
    .use(rehypeParse)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .use(rehypeLowlight as any)
    .use(rehypeStringify)
    .process(html);

  return file.toString();
}

/**
 * This "unified" plugin was built after consulting this example
 * in the "starry night" package:
 * https://github.com/wooorm/starry-night#example-integrate-with-unified-remark-and-rehype
 *
 * Even though we are using "lowlight", the code is very
 * similar.
 */

export default function rehypeLowlight() {
  const prefix = "language-";

  return function (tree: Node) {
    visit(tree, "element", function (node, index, parent) {
      if (!parent || index === null || node.tagName !== "pre") {
        return;
      }

      const head = node.children[0];

      if (
        !head ||
        head.type !== "element" ||
        head.tagName !== "code" ||
        !head.properties
      ) {
        return;
      }

      const classes = head.properties.className as string[];

      if (!Array.isArray(classes)) return;

      const language = classes
        .find((d) => typeof d === "string" && d.startsWith(prefix))
        ?.slice(prefix.length);

      if (typeof language !== "string") return;

      let fragment: Root;

      try {
        fragment = lowlight.highlight(language, toString(head));
      } catch (e) {
        console.debug("Error parsing post codeblock with lowlight.", e);
        return;
      }

      parent.children.splice(index, 1, {
        type: "element",
        tagName: "pre",
        properties: {},
        children: [
          {
            type: "element",
            tagName: "code",
            properties: {
              className: ["language-" + language],
            },
            children: fragment.children,
          },
        ],
      });
    });
  };
}
