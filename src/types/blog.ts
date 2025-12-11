/**
 * Blog post types for the Insights section
 */

export interface BlogPost {
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    image: {
        src: string;
        alt: string;
    };
    author: {
        id: string;
        name: string;
        role: string;
    };
    publishedAt: string;
    tags: string[];
    readTime: number;
}
