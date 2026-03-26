/* eslint-disable no-underscore-dangle */

export type EntityID = string;

export abstract class Entity<T> {
  protected _id: EntityID;

  public props: T;

  constructor(props: T, id: EntityID) {
    this.props = props;
    this._id = id;
  }

  public equals(entity?: Entity<T>): boolean {
    if (!entity) {
      return false;
    }

    if (this === entity) {
      return true;
    }

    if (entity instanceof Entity === false) {
      return false;
    }

    return this.id === entity.id;
  }

  get id(): EntityID {
    return this._id;
  }
}
