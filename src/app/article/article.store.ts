import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ComponentStore,
  OnStateInit,
  tapResponse,
} from '@ngrx/component-store';
import {
  defer,
  exhaustMap,
  filter,
  forkJoin,
  map,
  Observable,
  pipe,
  switchMap,
  tap,
  withLatestFrom,
} from 'rxjs';
import {
  ApiClient,
  Article,
  Comment,
  Profile,
} from '../shared/data-access/api';
import { AuthStore } from '../shared/data-access/auth.store';
import { ApiStatus } from '../shared/data-access/models';

export type CommentWithOwner = Comment & { isOwner: boolean };

export interface ArticleState {
  article: Article | null;
  comments: Comment[];
  status: ApiStatus;
}

export const initialArticleState: ArticleState = {
  comments: [],
  article: null,
  status: 'idle',
};

export type ArticleVm = Omit<ArticleState, 'comments'> & {
  isOwner: boolean;
  comments: CommentWithOwner[];
  currentUser: Profile;
};

@Injectable()
export class ArticleStore
  extends ComponentStore<ArticleState>
  implements OnStateInit
{
  readonly slug$ = this.route.params.pipe(
    map((params) => params['slug']),
    filter((slug): slug is string => slug)
  );

  readonly article$ = this.select((s) => s.article);
  readonly comments$ = this.select((s) => s.comments);
  readonly status$ = this.select((s) => s.status);

  readonly vm$: Observable<ArticleVm> = this.select(
    this.authStore.auth$,
    this.article$,
    this.comments$,
    this.status$.pipe(filter((status) => status !== 'idle')),
    (auth, article, comments, status) => {
      return {
        article,
        comments: comments.map((comment) => {
          if (comment.author.username === auth.user?.username)
            return { ...comment, isOwner: true };
          return { ...comment, isOwner: false };
        }),
        status,
        currentUser: auth.profile!,
        isOwner: auth.user?.username === article?.author.username,
      };
    },
    { debounce: true }
  );

  constructor(
    private apiClient: ApiClient,
    private route: ActivatedRoute,
    private router: Router,
    private authStore: AuthStore
  ) {
    super(initialArticleState);
  }

  ngrxOnStateInit() {
    this.getArticle(this.slug$);
  }

  readonly getArticle = this.effect<string>(
    pipe(
      tap(() => this.patchState({ status: 'loading' })),
      switchMap((slug) =>
        forkJoin([
          this.apiClient.getArticle(slug),
          this.apiClient.getArticleComments(slug),
        ]).pipe(
          tapResponse(
            ([{ article }, { comments }]) => {
              this.patchState({ article, comments, status: 'success' });
            },
            (error) => {
              console.error('error getting article/comments: ', error);
              this.patchState({ status: 'error' });
            }
          )
        )
      )
    )
  );

  readonly toggleFavorite = this.effect<Article>(
    exhaustMap((article) =>
      defer(() => {
        if (article.favorited)
          return this.apiClient.deleteArticleFavorite(article.slug);
        return this.apiClient.createArticleFavorite(article.slug);
      }).pipe(
        tapResponse(
          (response) => {
            this.patchState({ article: response.article });
          },
          (error) => {
            console.error('error toggling article favorite: ', error);
          }
        )
      )
    )
  );

  readonly deleteArticle = this.effect<Article>(
    exhaustMap((article) =>
      this.apiClient.deleteArticle(article.slug).pipe(
        tapResponse(
          () => {
            void this.router.navigate(['/']);
          },
          (error) => {
            console.error('error deleting article: ', error);
          }
        )
      )
    )
  );

  readonly toggleFollowAuthor = this.effect<Profile>(
    exhaustMap((profile) =>
      defer(() => {
        if (profile.following)
          return this.apiClient.unfollowUserByUsername(profile.username);
        return this.apiClient.followUserByUsername(profile.username);
      }).pipe(
        tapResponse(
          (response) => {
            this.patchState((state) => ({
              article: {
                ...state.article!,
                author: response.profile,
              },
            }));
          },
          (error) => {
            console.error('error toggling following author: ', error);
          }
        )
      )
    )
  );

  readonly createComment = this.effect<string>(
    pipe(
      withLatestFrom(this.article$),
      exhaustMap(([comment, article]) =>
        this.apiClient
          .createArticleComment(article!.slug, {
            comment: { body: comment },
          })
          .pipe(
            tapResponse(
              (response) => {
                this.patchState((state) => ({
                  comments: [...state.comments, response.comment],
                }));
              },
              (error) => {
                console.error('error creating new comment: ', error);
              }
            )
          )
      )
    )
  );

  readonly deleteComment = this.effect<CommentWithOwner>(
    pipe(
      withLatestFrom(this.article$),
      exhaustMap(([commentWithOwner, article]) =>
        this.apiClient
          .deleteArticleComment(article!.slug, commentWithOwner.id)
          .pipe(
            tapResponse(
              () => {
                this.patchState((state) => ({
                  comments: state.comments.filter(
                    (comment) => comment.id !== commentWithOwner.id
                  ),
                }));
              },
              (error) => {
                console.error('error deleting comment: ', error);
              }
            )
          )
      )
    )
  );
}
