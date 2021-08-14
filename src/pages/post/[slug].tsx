import { GetStaticPaths, GetStaticProps } from 'next';
import Link from 'next/link';
import Head from 'next/head';
import Prismic from '@prismicio/client';

import { format } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';
import { FiCalendar, FiUser, FiClock, FiLoader } from 'react-icons/fi';
import { RichText } from 'prismic-dom';
import { useRouter } from 'next/router';
import { getPrismicClient } from '../../services/prismic';

import Comments from '../../components/Comments';

import commonStyles from '../../styles/common.module.scss';
import styles from './post.module.scss';

interface Post {
  first_publication_date: string | null;
  last_publication_date: string | null;
  data: {
    title: string;
    banner: {
      url: string;
    };
    author: string;
    content: {
      heading: string;
      body: {
        text: string;
      }[];
    }[];
  };
}

interface PostProps {
  post: Post;
  postNavigation: {
    previousPost: {
      uid: string;
      data: {
        title: string;
      };
    }[];
    nextPost: {
      uid: string;
      data: {
        title: string;
      };
    }[];
  };
  preview: boolean;
}

export default function Post({ post, postNavigation, preview }: PostProps) {
  const router = useRouter();

  const totalWordsInPost = post.data.content.reduce((total, contentType) => {
    total += contentType.heading.split(' ').length;

    const wordsInBody = contentType.body.map(
      item => item.text.split(' ').length
    );
    wordsInBody.map(word => (total += word));

    return total;
  }, 0);

  const readingTime = Math.ceil(totalWordsInPost / 200);

  const formattedFirstPublicationDate = format(
    new Date(post.first_publication_date),
    'd MMM y',
    {
      locale: ptBR,
    }
  );

  const formattedLastPublicationDate = format(
    new Date(post.last_publication_date),
    "'* editado em' d MMM y', às' H':'mm'",
    {
      locale: ptBR,
    }
  );

  if (router.isFallback) {
    return (
      <h1>
        Carregando... <FiLoader />
      </h1>
    );
  }

  return (
    <>
      <Head>
        <title>{`${post.data.title} | spacetravelling`}</title>
      </Head>

      <img
        src={post.data.banner.url}
        alt="Post banner"
        className={styles.banner}
      />
      <main className={commonStyles.container}>
        <div className={styles.post}>
          <h1>{post.data.title}</h1>
          <ul>
            <li>
              <time>
                <FiCalendar />
                {formattedFirstPublicationDate}
              </time>
            </li>
            <li>
              <FiUser />
              {post.data.author}
            </li>
            <li>
              <FiClock />
              {`${readingTime} min`}
            </li>
          </ul>

          <ul>
            <li>
              <time>{formattedLastPublicationDate}</time>
            </li>
          </ul>

          {post.data.content.map(content => {
            return (
              <article key={content.heading}>
                <h2>{content.heading}</h2>
                <div
                  dangerouslySetInnerHTML={{
                    __html: RichText.asHtml(content.body),
                  }}
                />
              </article>
            );
          })}
        </div>

        <div className={styles.navigation}>
          {postNavigation?.previousPost.length > 0 && (
            <div>
              <h3>{postNavigation.previousPost[0].data.title}</h3>
              <Link href={`/post/${postNavigation.previousPost[0].uid}`}>
                <a>
                  Post anterior
                </a>
              </Link>
            </div>
          )}

          {postNavigation?.nextPost.length > 0 && (
            <div>
              <h3>{postNavigation.nextPost[0].data.title}</h3>
              <Link href={`/post/${postNavigation.nextPost[0].uid}`}>
                <a>
                  Próximo post
                </a>
              </Link>
            </div>
          )}
        </div>

        <Comments />

        {preview && (
          <aside>
            <Link href="/api/exit-preview">
              <a className={commonStyles.preview}>
                Sair do modo Preview
              </a>
            </Link>
          </aside>
        )}
      </main>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const prismic = getPrismicClient();
  const posts = await prismic.query([
    Prismic.predicates.at('document.type', 'posts'),
  ]);

  const paths = posts.results.map(post => {
    return {
      params: {
        slug: post.uid,
      },
    };
  });

  return {
    paths,
    fallback: true,
  };
};

export const getStaticProps: GetStaticProps = async ({
  params,
  preview = false,
  previewData,
}) => {
  const prismic = getPrismicClient();
  const { slug } = params;

  const response = await prismic.getByUID('posts', String(slug), {
    ref: previewData?.ref || null,
  });

  const previousPost = await prismic.query([
    Prismic.predicates.at('document.type', 'posts')
  ], {
    pageSize: 1,
    after: response.id,
    orderings: '[document.first_publication_date]'
  });

  const nextPost = await prismic.query([
    Prismic.predicates.at('document.type', 'posts')
  ], {
    pageSize: 1,
    after: response.id,
    orderings: '[document.last_publication_date]'
  });

  const post = {
    uid: response.uid,
    first_publication_date: response.first_publication_date,
    last_publication_date: response.last_publication_date,
    data: {
      banner: {
        url: response.data.banner.url,
      },
      title: response.data.title,
      subtitle: response.data.subtitle,
      author: response.data.author,
      content: response.data.content.map(content => {
        return {
          heading: content.heading,
          body: [...content.body],
        };
      }),
    },
  };

  return {
    props: {
      post,
      postNavigation: {
        previousPost: previousPost?.results,
        nextPost: nextPost?.results,
      },
      preview,
    },
  };
};
