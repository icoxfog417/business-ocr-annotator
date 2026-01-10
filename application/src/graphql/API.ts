/* tslint:disable */
/* eslint-disable */
//  This file was automatically generated and should not be edited.

export type Annotation = {
  __typename: "Annotation",
  answer: string,
  boundingBox?: string | null,
  createdAt: string,
  createdBy: string,
  id: string,
  imageId: string,
  question: string,
  updatedAt: string,
};

export type Image = {
  __typename: "Image",
  createdAt: string,
  fileName: string,
  id: string,
  metadata?: string | null,
  s3Key: string,
  updatedAt: string,
  uploadedAt: string,
  uploadedBy: string,
};

export type ModelAnnotationFilterInput = {
  and?: Array< ModelAnnotationFilterInput | null > | null,
  answer?: ModelStringInput | null,
  boundingBox?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  createdBy?: ModelStringInput | null,
  id?: ModelIDInput | null,
  imageId?: ModelIDInput | null,
  not?: ModelAnnotationFilterInput | null,
  or?: Array< ModelAnnotationFilterInput | null > | null,
  question?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelStringInput = {
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  beginsWith?: string | null,
  between?: Array< string | null > | null,
  contains?: string | null,
  eq?: string | null,
  ge?: string | null,
  gt?: string | null,
  le?: string | null,
  lt?: string | null,
  ne?: string | null,
  notContains?: string | null,
  size?: ModelSizeInput | null,
};

export enum ModelAttributeTypes {
  _null = "_null",
  binary = "binary",
  binarySet = "binarySet",
  bool = "bool",
  list = "list",
  map = "map",
  number = "number",
  numberSet = "numberSet",
  string = "string",
  stringSet = "stringSet",
}


export type ModelSizeInput = {
  between?: Array< number | null > | null,
  eq?: number | null,
  ge?: number | null,
  gt?: number | null,
  le?: number | null,
  lt?: number | null,
  ne?: number | null,
};

export type ModelIDInput = {
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  beginsWith?: string | null,
  between?: Array< string | null > | null,
  contains?: string | null,
  eq?: string | null,
  ge?: string | null,
  gt?: string | null,
  le?: string | null,
  lt?: string | null,
  ne?: string | null,
  notContains?: string | null,
  size?: ModelSizeInput | null,
};

export type ModelAnnotationConnection = {
  __typename: "ModelAnnotationConnection",
  items:  Array<Annotation | null >,
  nextToken?: string | null,
};

export type ModelImageFilterInput = {
  and?: Array< ModelImageFilterInput | null > | null,
  createdAt?: ModelStringInput | null,
  fileName?: ModelStringInput | null,
  id?: ModelIDInput | null,
  metadata?: ModelStringInput | null,
  not?: ModelImageFilterInput | null,
  or?: Array< ModelImageFilterInput | null > | null,
  s3Key?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  uploadedAt?: ModelStringInput | null,
  uploadedBy?: ModelStringInput | null,
};

export type ModelImageConnection = {
  __typename: "ModelImageConnection",
  items:  Array<Image | null >,
  nextToken?: string | null,
};

export type ModelAnnotationConditionInput = {
  and?: Array< ModelAnnotationConditionInput | null > | null,
  answer?: ModelStringInput | null,
  boundingBox?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  createdBy?: ModelStringInput | null,
  imageId?: ModelIDInput | null,
  not?: ModelAnnotationConditionInput | null,
  or?: Array< ModelAnnotationConditionInput | null > | null,
  question?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateAnnotationInput = {
  answer: string,
  boundingBox?: string | null,
  createdAt?: string | null,
  createdBy: string,
  id?: string | null,
  imageId: string,
  question: string,
};

export type ModelImageConditionInput = {
  and?: Array< ModelImageConditionInput | null > | null,
  createdAt?: ModelStringInput | null,
  fileName?: ModelStringInput | null,
  metadata?: ModelStringInput | null,
  not?: ModelImageConditionInput | null,
  or?: Array< ModelImageConditionInput | null > | null,
  s3Key?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  uploadedAt?: ModelStringInput | null,
  uploadedBy?: ModelStringInput | null,
};

export type CreateImageInput = {
  fileName: string,
  id?: string | null,
  metadata?: string | null,
  s3Key: string,
  uploadedAt: string,
  uploadedBy: string,
};

export type DeleteAnnotationInput = {
  id: string,
};

export type DeleteImageInput = {
  id: string,
};

export type UpdateAnnotationInput = {
  answer?: string | null,
  boundingBox?: string | null,
  createdAt?: string | null,
  createdBy?: string | null,
  id: string,
  imageId?: string | null,
  question?: string | null,
};

export type UpdateImageInput = {
  fileName?: string | null,
  id: string,
  metadata?: string | null,
  s3Key?: string | null,
  uploadedAt?: string | null,
  uploadedBy?: string | null,
};

export type ModelSubscriptionAnnotationFilterInput = {
  and?: Array< ModelSubscriptionAnnotationFilterInput | null > | null,
  answer?: ModelSubscriptionStringInput | null,
  boundingBox?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  createdBy?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  imageId?: ModelSubscriptionIDInput | null,
  or?: Array< ModelSubscriptionAnnotationFilterInput | null > | null,
  question?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionStringInput = {
  beginsWith?: string | null,
  between?: Array< string | null > | null,
  contains?: string | null,
  eq?: string | null,
  ge?: string | null,
  gt?: string | null,
  in?: Array< string | null > | null,
  le?: string | null,
  lt?: string | null,
  ne?: string | null,
  notContains?: string | null,
  notIn?: Array< string | null > | null,
};

export type ModelSubscriptionIDInput = {
  beginsWith?: string | null,
  between?: Array< string | null > | null,
  contains?: string | null,
  eq?: string | null,
  ge?: string | null,
  gt?: string | null,
  in?: Array< string | null > | null,
  le?: string | null,
  lt?: string | null,
  ne?: string | null,
  notContains?: string | null,
  notIn?: Array< string | null > | null,
};

export type ModelSubscriptionImageFilterInput = {
  and?: Array< ModelSubscriptionImageFilterInput | null > | null,
  createdAt?: ModelSubscriptionStringInput | null,
  fileName?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  metadata?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionImageFilterInput | null > | null,
  s3Key?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  uploadedAt?: ModelSubscriptionStringInput | null,
  uploadedBy?: ModelSubscriptionStringInput | null,
};

export type GetAnnotationQueryVariables = {
  id: string,
};

export type GetAnnotationQuery = {
  getAnnotation?:  {
    __typename: "Annotation",
    answer: string,
    boundingBox?: string | null,
    createdAt: string,
    createdBy: string,
    id: string,
    imageId: string,
    question: string,
    updatedAt: string,
  } | null,
};

export type GetImageQueryVariables = {
  id: string,
};

export type GetImageQuery = {
  getImage?:  {
    __typename: "Image",
    createdAt: string,
    fileName: string,
    id: string,
    metadata?: string | null,
    s3Key: string,
    updatedAt: string,
    uploadedAt: string,
    uploadedBy: string,
  } | null,
};

export type ListAnnotationsQueryVariables = {
  filter?: ModelAnnotationFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListAnnotationsQuery = {
  listAnnotations?:  {
    __typename: "ModelAnnotationConnection",
    items:  Array< {
      __typename: "Annotation",
      answer: string,
      boundingBox?: string | null,
      createdAt: string,
      createdBy: string,
      id: string,
      imageId: string,
      question: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListImagesQueryVariables = {
  filter?: ModelImageFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListImagesQuery = {
  listImages?:  {
    __typename: "ModelImageConnection",
    items:  Array< {
      __typename: "Image",
      createdAt: string,
      fileName: string,
      id: string,
      metadata?: string | null,
      s3Key: string,
      updatedAt: string,
      uploadedAt: string,
      uploadedBy: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type CreateAnnotationMutationVariables = {
  condition?: ModelAnnotationConditionInput | null,
  input: CreateAnnotationInput,
};

export type CreateAnnotationMutation = {
  createAnnotation?:  {
    __typename: "Annotation",
    answer: string,
    boundingBox?: string | null,
    createdAt: string,
    createdBy: string,
    id: string,
    imageId: string,
    question: string,
    updatedAt: string,
  } | null,
};

export type CreateImageMutationVariables = {
  condition?: ModelImageConditionInput | null,
  input: CreateImageInput,
};

export type CreateImageMutation = {
  createImage?:  {
    __typename: "Image",
    createdAt: string,
    fileName: string,
    id: string,
    metadata?: string | null,
    s3Key: string,
    updatedAt: string,
    uploadedAt: string,
    uploadedBy: string,
  } | null,
};

export type DeleteAnnotationMutationVariables = {
  condition?: ModelAnnotationConditionInput | null,
  input: DeleteAnnotationInput,
};

export type DeleteAnnotationMutation = {
  deleteAnnotation?:  {
    __typename: "Annotation",
    answer: string,
    boundingBox?: string | null,
    createdAt: string,
    createdBy: string,
    id: string,
    imageId: string,
    question: string,
    updatedAt: string,
  } | null,
};

export type DeleteImageMutationVariables = {
  condition?: ModelImageConditionInput | null,
  input: DeleteImageInput,
};

export type DeleteImageMutation = {
  deleteImage?:  {
    __typename: "Image",
    createdAt: string,
    fileName: string,
    id: string,
    metadata?: string | null,
    s3Key: string,
    updatedAt: string,
    uploadedAt: string,
    uploadedBy: string,
  } | null,
};

export type UpdateAnnotationMutationVariables = {
  condition?: ModelAnnotationConditionInput | null,
  input: UpdateAnnotationInput,
};

export type UpdateAnnotationMutation = {
  updateAnnotation?:  {
    __typename: "Annotation",
    answer: string,
    boundingBox?: string | null,
    createdAt: string,
    createdBy: string,
    id: string,
    imageId: string,
    question: string,
    updatedAt: string,
  } | null,
};

export type UpdateImageMutationVariables = {
  condition?: ModelImageConditionInput | null,
  input: UpdateImageInput,
};

export type UpdateImageMutation = {
  updateImage?:  {
    __typename: "Image",
    createdAt: string,
    fileName: string,
    id: string,
    metadata?: string | null,
    s3Key: string,
    updatedAt: string,
    uploadedAt: string,
    uploadedBy: string,
  } | null,
};

export type OnCreateAnnotationSubscriptionVariables = {
  filter?: ModelSubscriptionAnnotationFilterInput | null,
};

export type OnCreateAnnotationSubscription = {
  onCreateAnnotation?:  {
    __typename: "Annotation",
    answer: string,
    boundingBox?: string | null,
    createdAt: string,
    createdBy: string,
    id: string,
    imageId: string,
    question: string,
    updatedAt: string,
  } | null,
};

export type OnCreateImageSubscriptionVariables = {
  filter?: ModelSubscriptionImageFilterInput | null,
};

export type OnCreateImageSubscription = {
  onCreateImage?:  {
    __typename: "Image",
    createdAt: string,
    fileName: string,
    id: string,
    metadata?: string | null,
    s3Key: string,
    updatedAt: string,
    uploadedAt: string,
    uploadedBy: string,
  } | null,
};

export type OnDeleteAnnotationSubscriptionVariables = {
  filter?: ModelSubscriptionAnnotationFilterInput | null,
};

export type OnDeleteAnnotationSubscription = {
  onDeleteAnnotation?:  {
    __typename: "Annotation",
    answer: string,
    boundingBox?: string | null,
    createdAt: string,
    createdBy: string,
    id: string,
    imageId: string,
    question: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteImageSubscriptionVariables = {
  filter?: ModelSubscriptionImageFilterInput | null,
};

export type OnDeleteImageSubscription = {
  onDeleteImage?:  {
    __typename: "Image",
    createdAt: string,
    fileName: string,
    id: string,
    metadata?: string | null,
    s3Key: string,
    updatedAt: string,
    uploadedAt: string,
    uploadedBy: string,
  } | null,
};

export type OnUpdateAnnotationSubscriptionVariables = {
  filter?: ModelSubscriptionAnnotationFilterInput | null,
};

export type OnUpdateAnnotationSubscription = {
  onUpdateAnnotation?:  {
    __typename: "Annotation",
    answer: string,
    boundingBox?: string | null,
    createdAt: string,
    createdBy: string,
    id: string,
    imageId: string,
    question: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateImageSubscriptionVariables = {
  filter?: ModelSubscriptionImageFilterInput | null,
};

export type OnUpdateImageSubscription = {
  onUpdateImage?:  {
    __typename: "Image",
    createdAt: string,
    fileName: string,
    id: string,
    metadata?: string | null,
    s3Key: string,
    updatedAt: string,
    uploadedAt: string,
    uploadedBy: string,
  } | null,
};
